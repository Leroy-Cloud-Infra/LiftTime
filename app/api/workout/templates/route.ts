import { NextRequest, NextResponse } from "next/server";

import { getAuthEnv } from "@/lib/server/auth/env";
import { verifyAppSessionToken } from "@/lib/server/auth/session";
import type { WorkoutLibraryResponse } from "@/types/workoutLibrary";

export const runtime = "nodejs";

interface TemplateRow {
  id: string;
  name: string;
}

interface TemplateExerciseRow {
  workout_template_id: string;
  exercise_id: string;
  order_index: number;
}

interface CatalogRow {
  id: string;
  name: string;
}

const restUrl = (supabaseUrl: string, table: string, query: Record<string, string>): string => {
  const url = new URL(`rest/v1/${table}`, supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  let env;
  try {
    env = getAuthEnv();
  } catch {
    return NextResponse.json({ error: "AUTH_ENV_INVALID" }, { status: 500 });
  }

  const token = request.cookies.get(env.appSessionCookieName)?.value;
  if (!verifyAppSessionToken(token, env.appSessionSecret).ok) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const headers = {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`
  };

  try {
    const templatesResponse = await fetch(
      restUrl(env.supabaseUrl, "workout_templates", {
        select: "id,name",
        is_active: "eq.true",
        order: "name.asc,id.asc"
      }),
      { headers, cache: "no-store" }
    );
    if (!templatesResponse.ok) {
      throw new Error("TEMPLATE_FETCH_FAILED");
    }

    const templates = (await templatesResponse.json()) as TemplateRow[];
    if (templates.length === 0) {
      return NextResponse.json({ items: [] } satisfies WorkoutLibraryResponse);
    }

    const templateIds = templates.map((template) => template.id);
    const exerciseResponse = await fetch(
      restUrl(env.supabaseUrl, "workout_template_exercises", {
        select: "workout_template_id,exercise_id,order_index",
        workout_template_id: `in.(${templateIds.join(",")})`,
        order: "workout_template_id.asc,order_index.asc"
      }),
      { headers, cache: "no-store" }
    );
    if (!exerciseResponse.ok) {
      throw new Error("TEMPLATE_EXERCISE_FETCH_FAILED");
    }
    const templateExercises = (await exerciseResponse.json()) as TemplateExerciseRow[];
    const exerciseIds = [...new Set(templateExercises.map((exercise) => exercise.exercise_id))];
    if (exerciseIds.length === 0) {
      throw new Error("EMPTY_TEMPLATE_LIBRARY");
    }
    const catalogResponse = await fetch(
      restUrl(env.supabaseUrl, "exercises", {
        select: "id,name",
        id: `in.(${exerciseIds.join(",")})`,
        is_active: "eq.true"
      }),
      { headers, cache: "no-store" }
    );
    if (!catalogResponse.ok) {
      throw new Error("CATALOG_FETCH_FAILED");
    }
    const names = new Map(((await catalogResponse.json()) as CatalogRow[]).map((row) => [row.id, row.name]));

    const result: WorkoutLibraryResponse = {
      items: templates.map((template) => ({
        id: template.id,
        name: template.name,
        exerciseNames: templateExercises
          .filter((exercise) => exercise.workout_template_id === template.id)
          .sort((left, right) => left.order_index - right.order_index)
          .map((exercise) => names.get(exercise.exercise_id) ?? "")
      }))
    };

    if (result.items.some((item) => item.exerciseNames.length === 0 || item.exerciseNames.includes(""))) {
      throw new Error("TEMPLATE_CATALOG_MISMATCH");
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "WORKOUT_LIBRARY_FETCH_FAILED" }, { status: 500 });
  }
}
