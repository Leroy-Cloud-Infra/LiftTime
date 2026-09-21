import { NextRequest, NextResponse } from "next/server";

import { getAuthEnv } from "@/lib/server/auth/env";
import { verifyAppSessionToken } from "@/lib/server/auth/session";

export const runtime = "nodejs";

type SetType = "working" | "warmup" | "drop" | "failure";

interface DbWorkoutSession {
  id: string;
  user_id: string;
  name: string | null;
  status: "active" | "completed" | "incomplete";
  started_at: string;
  ended_at: string | null;
}

interface DbWorkoutExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  superset_group_id: string | null;
  created_at: string;
}

interface DbWorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  set_type: SetType;
  weight_lbs: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

interface DbExerciseCatalog {
  id: string;
  name: string;
  equipment: string[];
  muscle_groups: string[];
  instructions: string[];
  cues: string[];
  progressive_overload_notes: string | null;
}

interface ActiveWorkoutBootstrapResult {
  active: true;
  session: DbWorkoutSession;
  workoutExercises: DbWorkoutExercise[];
  workoutSets: DbWorkoutSet[];
  exercisesById: Record<string, DbExerciseCatalog>;
}

interface NoActiveWorkoutBootstrapResult {
  active: false;
}

type WorkoutBootstrapResult = ActiveWorkoutBootstrapResult | NoActiveWorkoutBootstrapResult;

const buildInFilter = (values: string[]): string | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  return `in.(${values.join(",")})`;
};

const createServiceHeaders = (serviceRoleKey: string, includeJson = true): HeadersInit => {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const buildRestUrl = (
  supabaseUrl: string,
  path: string,
  query?: Record<string, string | undefined>
): string => {
  const base = supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`;
  const url = new URL(`rest/v1/${path}`, base);

  if (query) {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      searchParams.set(key, value);
    });
    url.search = searchParams.toString();
  }

  return url.toString();
};

const fetchActiveWorkoutSession = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
): Promise<DbWorkoutSession | null> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sessions", {
      select: "*",
      user_id: `eq.${userId}`,
      status: "eq.active",
      order: "started_at.desc",
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("ACTIVE_SESSION_FETCH_FAILED");
  }

  const rows = (await response.json()) as DbWorkoutSession[];
  return rows[0] ?? null;
};

const fetchSessionBundle = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string
): Promise<Pick<ActiveWorkoutBootstrapResult, "workoutExercises" | "workoutSets" | "exercisesById">> => {
  const exercisesResponse = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "order_index.asc"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!exercisesResponse.ok) {
    throw new Error("WORKOUT_EXERCISE_FETCH_FAILED");
  }

  const workoutExercises = (await exercisesResponse.json()) as DbWorkoutExercise[];
  if (workoutExercises.length === 0) {
    return {
      workoutExercises: [],
      workoutSets: [],
      exercisesById: {}
    };
  }

  const workoutExerciseIds = workoutExercises.map((exercise) => exercise.id);
  const setsResponse = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "*",
      workout_exercise_id: buildInFilter(workoutExerciseIds),
      order: "set_number.asc"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!setsResponse.ok) {
    throw new Error("WORKOUT_SET_FETCH_FAILED");
  }

  const workoutSets = (await setsResponse.json()) as DbWorkoutSet[];
  const exerciseIds = [...new Set(workoutExercises.map((exercise) => exercise.exercise_id))];

  const catalogResponse = await fetch(
    buildRestUrl(supabaseUrl, "exercises", {
      select: "id,name,equipment,muscle_groups,instructions,cues,progressive_overload_notes",
      id: buildInFilter(exerciseIds)
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!catalogResponse.ok) {
    throw new Error("EXERCISE_CATALOG_FETCH_FAILED");
  }

  const catalogRows = (await catalogResponse.json()) as DbExerciseCatalog[];
  const exercisesById = catalogRows.reduce<Record<string, DbExerciseCatalog>>((accumulator, row) => {
    accumulator[row.id] = row;
    return accumulator;
  }, {});

  return {
    workoutExercises,
    workoutSets,
    exercisesById
  };
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
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const userId = sessionCheck.payload.sub;
    const session = await fetchActiveWorkoutSession(env.supabaseUrl, env.supabaseServiceRoleKey, userId);

    if (!session) {
      return NextResponse.json<WorkoutBootstrapResult>({ active: false });
    }

    const bundle = await fetchSessionBundle(env.supabaseUrl, env.supabaseServiceRoleKey, session.id);
    return NextResponse.json<WorkoutBootstrapResult>({
      active: true,
      session,
      ...bundle
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WORKOUT_BOOTSTRAP_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
