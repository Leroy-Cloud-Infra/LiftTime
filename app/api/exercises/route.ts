import { NextRequest, NextResponse } from "next/server";

import { getAuthEnv } from "@/lib/server/auth/env";
import { verifyAppSessionToken } from "@/lib/server/auth/session";
import type { ExerciseCatalogResponse, ExerciseCatalogSummary } from "@/types/exerciseCatalog";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MAX_OFFSET = 100_000;
const MAX_SEARCH_LENGTH = 100;
const TAXONOMY_VALUE_PATTERN = /^[a-z][a-z_]*$/;
const SEARCH_VALUE_PATTERN = /^[A-Za-z0-9 '\-]+$/;

interface CatalogRow {
  id: string;
  name: string;
  slug: string;
  muscle_groups: string[];
  equipment: string[];
  category: ExerciseCatalogSummary["category"];
  difficulty: ExerciseCatalogSummary["difficulty"];
  tracking_type: string;
  default_sets: number;
  default_reps: number;
  is_bodyweight: boolean;
}

interface FacetRow {
  muscle_groups: string[];
  equipment: string[];
}

const createServiceHeaders = (serviceRoleKey: string): HeadersInit => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
});

const buildRestUrl = (supabaseUrl: string, path: string, query: Record<string, string>): string => {
  const base = supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`;
  const url = new URL(`rest/v1/${path}`, base);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

const parseBoundedInteger = (
  rawValue: string | null,
  defaultValue: number,
  maxValue: number,
  minValue: number
): number | null => {
  if (rawValue === null || rawValue.length === 0) {
    return defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < minValue) {
    return null;
  }

  return Math.min(parsed, maxValue);
};

const mapCatalogRow = (row: CatalogRow): ExerciseCatalogSummary => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  muscleGroups: row.muscle_groups,
  equipment: row.equipment,
  category: row.category,
  difficulty: row.difficulty,
  trackingType: row.tracking_type,
  defaultSets: row.default_sets,
  defaultReps: row.default_reps,
  isBodyweight: row.is_bodyweight
});

const unauthorizedResponse = (): NextResponse => {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
};

const invalidQueryResponse = (): NextResponse => {
  return NextResponse.json({ error: "INVALID_CATALOG_QUERY" }, { status: 400 });
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  let env;
  try {
    env = getAuthEnv();
  } catch {
    return NextResponse.json({ error: "AUTH_ENV_INVALID" }, { status: 500 });
  }

  const token = request.cookies.get(env.appSessionCookieName)?.value;
  const sessionCheck = verifyAppSessionToken(token, env.appSessionSecret);
  if (!sessionCheck.ok || !sessionCheck.payload) {
    return unauthorizedResponse();
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const muscle = request.nextUrl.searchParams.get("muscle")?.trim() ?? "";
  const equipment = request.nextUrl.searchParams.get("equipment")?.trim() ?? "";
  const limit = parseBoundedInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT, 1);
  const offset = parseBoundedInteger(request.nextUrl.searchParams.get("offset"), 0, MAX_OFFSET, 0);

  if (
    limit === null ||
    offset === null ||
    q.length > MAX_SEARCH_LENGTH ||
    (q.length > 0 && !SEARCH_VALUE_PATTERN.test(q)) ||
    (muscle.length > 0 && !TAXONOMY_VALUE_PATTERN.test(muscle)) ||
    (equipment.length > 0 && !TAXONOMY_VALUE_PATTERN.test(equipment))
  ) {
    return invalidQueryResponse();
  }

  const catalogQuery: Record<string, string> = {
    select:
      "id,name,slug,muscle_groups,equipment,category,difficulty,tracking_type,default_sets,default_reps,is_bodyweight",
    is_active: "eq.true",
    order: "name.asc,id.asc",
    limit: String(limit + 1),
    offset: String(offset)
  };

  if (q) {
    catalogQuery.name = `ilike.*${q}*`;
  }
  if (muscle) {
    catalogQuery.muscle_groups = `cs.{${muscle}}`;
  }
  if (equipment) {
    catalogQuery.equipment = `cs.{${equipment}}`;
  }

  try {
    const [catalogResponse, facetsResponse] = await Promise.all([
      fetch(buildRestUrl(env.supabaseUrl, "exercises", catalogQuery), {
        method: "GET",
        headers: createServiceHeaders(env.supabaseServiceRoleKey),
        cache: "no-store"
      }),
      fetch(
        buildRestUrl(env.supabaseUrl, "exercises", {
          select: "muscle_groups,equipment",
          is_active: "eq.true"
        }),
        {
          method: "GET",
          headers: createServiceHeaders(env.supabaseServiceRoleKey),
          cache: "no-store"
        }
      )
    ]);

    if (!catalogResponse.ok || !facetsResponse.ok) {
      return NextResponse.json({ error: "EXERCISE_CATALOG_FETCH_FAILED" }, { status: 500 });
    }

    const catalogRows = (await catalogResponse.json()) as CatalogRow[];
    const facetRows = (await facetsResponse.json()) as FacetRow[];
    const hasMore = catalogRows.length > limit;
    const items = catalogRows.slice(0, limit).map(mapCatalogRow);
    const muscleGroups = [...new Set(facetRows.flatMap((row) => row.muscle_groups))].sort();
    const equipmentValues = [...new Set(facetRows.flatMap((row) => row.equipment))].sort();

    const response: ExerciseCatalogResponse = {
      items,
      page: {
        limit,
        offset,
        hasMore
      },
      facets: {
        muscleGroups,
        equipment: equipmentValues
      }
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "EXERCISE_CATALOG_FETCH_FAILED" }, { status: 500 });
  }
}
