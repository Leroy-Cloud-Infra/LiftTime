import { NextRequest, NextResponse } from "next/server";

import { getAuthEnv } from "@/lib/server/auth/env";
import { verifyAppSessionToken } from "@/lib/server/auth/session";
import type {
  AddedWorkoutExercise,
  AddedWorkoutSet,
  ExerciseCatalogSummary
} from "@/types/exerciseCatalog";

export const runtime = "nodejs";

type MutationAction =
  | "complete_set"
  | "add_set"
  | "update_set"
  | "delete_set"
  | "delete_workout_exercises"
  | "add_workout_exercise"
  | "finish_workout_session"
  | "start_workout_session";
type SetType = "working" | "warmup" | "drop" | "failure";

interface CompleteSetPayload {
  workoutExerciseId: string;
  setId: string;
  setNumber: number;
  setType: SetType;
  weightLbs: number | null;
  reps: number | null;
  rir: number | null;
  completedAt: string;
}

interface AddSetPayload {
  workoutExerciseId: string;
  weightLbs: number | null;
  reps: number | null;
  setType?: SetType;
}

interface UpdateSetPayload {
  workoutExerciseId: string;
  setId: string;
  weightLbs: number | null;
  reps: number | null;
  rir: number | null;
  setType: SetType;
}

interface DeleteSetPayload {
  workoutExerciseId: string;
  setId: string;
}

interface DeleteWorkoutExercisesPayload {
  sessionId: string;
  workoutExerciseIds: string[];
}

interface AddWorkoutExercisePayload {
  sessionId: string;
  exerciseId: string;
}

interface FinishWorkoutSessionPayload {
  sessionId: string;
}

type StartWorkoutSessionPayload = Record<string, never>;

interface MutationRequestBody {
  action?: unknown;
  payload?: unknown;
}

interface WorkoutExerciseOwnerRow {
  id: string;
  session_id: string;
}

interface WorkoutSessionOwnerRow {
  id: string;
}

interface WorkoutSessionRow {
  id: string;
  status: "active" | "completed" | "incomplete";
  started_at: string;
  ended_at: string | null;
}

interface WorkoutExerciseRow {
  id: string;
}

interface WorkoutExerciseOrderRow {
  id: string;
  order_index: number;
}

interface WorkoutSetRow {
  id: string;
}

interface WorkoutSetStateRow {
  id: string;
  completed: boolean;
}

interface WorkoutSetNumberRow {
  set_number: number;
}

interface WorkoutSetOrderRow {
  id: string;
  set_number: number;
}

interface WorkoutSetRecord {
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

interface WorkoutExerciseRpcRow {
  outcome: "created" | "duplicate" | "session_not_found_or_forbidden" | "session_not_active" | "exercise_not_found_or_inactive";
  workout_exercise_id: string | null;
  session_id: string | null;
  exercise_id: string | null;
  order_index: number | null;
  superset_group_id: string | null;
  created_at: string | null;
  existing_workout_exercise_id: string | null;
}

interface StartWorkoutSessionRpcRow {
  outcome: "created" | "already_active";
  session_id: string;
}

interface WorkoutSetApiRow {
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

interface ExerciseCatalogApiRow {
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

interface SupabaseErrorResponse {
  code?: string;
}

type ParsedMutationRequest =
  | { action: "complete_set"; payload: CompleteSetPayload }
  | { action: "add_set"; payload: AddSetPayload }
  | { action: "update_set"; payload: UpdateSetPayload }
  | { action: "delete_set"; payload: DeleteSetPayload }
  | { action: "delete_workout_exercises"; payload: DeleteWorkoutExercisesPayload }
  | { action: "add_workout_exercise"; payload: AddWorkoutExercisePayload }
  | { action: "finish_workout_session"; payload: FinishWorkoutSessionPayload }
  | { action: "start_workout_session"; payload: StartWorkoutSessionPayload };

const allowedActions: readonly MutationAction[] = [
  "complete_set",
  "add_set",
  "update_set",
  "delete_set",
  "delete_workout_exercises",
  "add_workout_exercise",
  "finish_workout_session",
  "start_workout_session"
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isNonBlankString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isNullableNumber = (value: unknown): value is number | null => {
  return value === null || (typeof value === "number" && Number.isFinite(value));
};

const isValidSetType = (value: unknown): value is SetType => {
  return value === "working" || value === "warmup" || value === "drop" || value === "failure";
};

const isValidRir = (value: unknown): value is number | null => {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5);
};

const invalidInputResponse = () => {
  return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
};

const unauthorizedResponse = () => {
  return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
};

const forbiddenResponse = () => {
  return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
};

const notFoundResponse = () => {
  return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
};

const mutationFailedResponse = () => {
  return NextResponse.json({ ok: false, error: "MUTATION_FAILED" }, { status: 500 });
};

const notImplementedResponse = () => {
  return NextResponse.json({ ok: false, error: "MUTATION_NOT_IMPLEMENTED" }, { status: 501 });
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

const buildInFilter = (values: string[]): string | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  return `in.(${values.join(",")})`;
};

const parseSupabaseError = async (response: Response): Promise<SupabaseErrorResponse | null> => {
  try {
    return (await response.json()) as SupabaseErrorResponse;
  } catch {
    return null;
  }
};

const isValidIsoDateTime = (value: string): boolean => {
  return !Number.isNaN(Date.parse(value));
};

const loadWorkoutExerciseOwnership = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string
): Promise<WorkoutExerciseOwnerRow | null> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      select: "id,session_id",
      id: `eq.${workoutExerciseId}`,
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutExerciseOwnerRow[];
  return rows[0] ?? null;
};

const verifySessionOwnership = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  principalId: string
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sessions", {
      select: "id",
      id: `eq.${sessionId}`,
      user_id: `eq.${principalId}`,
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SESSION_OWNERSHIP_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutSessionOwnerRow[];
  return Boolean(rows[0]);
};

const verifyActiveSessionOwnership = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  principalId: string
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sessions", {
      select: "id",
      id: `eq.${sessionId}`,
      user_id: `eq.${principalId}`,
      status: "eq.active",
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("ACTIVE_WORKOUT_SESSION_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutSessionOwnerRow[];
  return Boolean(rows[0]);
};

const fetchWorkoutExerciseIdsForSession = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string
): Promise<string[]> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      select: "id",
      session_id: `eq.${sessionId}`
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SESSION_EXERCISE_LOOKUP_FAILED");
  }

  return ((await response.json()) as WorkoutExerciseRow[]).map((row) => row.id);
};

const fetchSessionSetStates = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseIds: string[]
): Promise<WorkoutSetStateRow[]> => {
  if (workoutExerciseIds.length === 0) {
    return [];
  }

  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "id,completed",
      workout_exercise_id: buildInFilter(workoutExerciseIds)
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SESSION_SET_LOOKUP_FAILED");
  }

  return (await response.json()) as WorkoutSetStateRow[];
};

const finishActiveWorkoutSession = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  principalId: string,
  status: "completed" | "incomplete",
  endedAt: string
): Promise<WorkoutSessionRow | null> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sessions", {
      id: `eq.${sessionId}`,
      user_id: `eq.${principalId}`,
      status: "eq.active"
    }),
    {
      method: "PATCH",
      headers: {
        ...createServiceHeaders(serviceRoleKey),
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status,
        ended_at: endedAt
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SESSION_FINISH_FAILED");
  }

  const rows = (await response.json()) as WorkoutSessionRow[];
  return rows[0] ?? null;
};

const sessionNotActiveResponse = () => {
  return NextResponse.json({ ok: false, error: "SESSION_NOT_ACTIVE" }, { status: 409 });
};

const checkWorkoutSetExists = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string,
  setId: string
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "id",
      id: `eq.${setId}`,
      workout_exercise_id: `eq.${workoutExerciseId}`,
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetRow[];
  return Boolean(rows[0]);
};

const loadWorkoutSetState = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string,
  setId: string
): Promise<WorkoutSetStateRow | null> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "id,completed",
      id: `eq.${setId}`,
      workout_exercise_id: `eq.${workoutExerciseId}`,
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_STATE_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetStateRow[];
  return rows[0] ?? null;
};

const updateCompletedSet = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: CompleteSetPayload
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      id: `eq.${payload.setId}`,
      workout_exercise_id: `eq.${payload.workoutExerciseId}`
    }),
    {
      method: "PATCH",
      headers: {
        ...createServiceHeaders(serviceRoleKey),
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        set_number: payload.setNumber,
        set_type: payload.setType,
        weight_lbs: payload.weightLbs,
        reps: payload.reps,
        rir: payload.rir,
        completed: true,
        completed_at: payload.completedAt
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const maybeError = await parseSupabaseError(response);
    if (response.status === 404 || maybeError?.code === "PGRST116") {
      return false;
    }

    throw new Error("WORKOUT_SET_UPDATE_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetRow[];
  return Boolean(rows[0]);
};

const fetchHighestSetNumber = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string
): Promise<number> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "set_number",
      workout_exercise_id: `eq.${workoutExerciseId}`,
      order: "set_number.desc",
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_NUMBER_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetNumberRow[];
  return rows[0]?.set_number ?? 0;
};

const insertSet = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: AddSetPayload,
  nextSetNumber: number
): Promise<WorkoutSetRecord> => {
  const response = await fetch(buildRestUrl(supabaseUrl, "workout_sets"), {
    method: "POST",
    headers: {
      ...createServiceHeaders(serviceRoleKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      workout_exercise_id: payload.workoutExerciseId,
      set_number: nextSetNumber,
      set_type: payload.setType ?? "working",
      weight_lbs: payload.weightLbs,
      reps: payload.reps,
      completed: false,
      completed_at: null
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("WORKOUT_SET_INSERT_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetRecord[];
  const created = rows[0];
  if (!created) {
    throw new Error("WORKOUT_SET_INSERT_EMPTY");
  }

  return created;
};

const updateSetValues = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: UpdateSetPayload
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      id: `eq.${payload.setId}`,
      workout_exercise_id: `eq.${payload.workoutExerciseId}`
    }),
    {
      method: "PATCH",
      headers: {
        ...createServiceHeaders(serviceRoleKey),
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        weight_lbs: payload.weightLbs,
        reps: payload.reps,
        rir: payload.rir,
        set_type: payload.setType
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const maybeError = await parseSupabaseError(response);
    if (response.status === 404 || maybeError?.code === "PGRST116") {
      return false;
    }

    throw new Error("WORKOUT_SET_VALUE_UPDATE_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetRow[];
  return Boolean(rows[0]);
};

const deleteSetById = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: DeleteSetPayload
): Promise<boolean> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      id: `eq.${payload.setId}`,
      workout_exercise_id: `eq.${payload.workoutExerciseId}`
    }),
    {
      method: "DELETE",
      headers: {
        ...createServiceHeaders(serviceRoleKey),
        Prefer: "return=representation"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_DELETE_FAILED");
  }

  const rows = (await response.json()) as WorkoutSetRow[];
  return Boolean(rows[0]);
};

const fetchSetOrderRows = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string
): Promise<WorkoutSetOrderRow[]> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "id,set_number",
      workout_exercise_id: `eq.${workoutExerciseId}`,
      order: "set_number.asc"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_ORDER_FETCH_FAILED");
  }

  return (await response.json()) as WorkoutSetOrderRow[];
};

const updateSetNumber = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string,
  setId: string,
  setNumber: number
): Promise<void> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      id: `eq.${setId}`,
      workout_exercise_id: `eq.${workoutExerciseId}`
    }),
    {
      method: "PATCH",
      headers: createServiceHeaders(serviceRoleKey),
      body: JSON.stringify({
        set_number: setNumber
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_SET_RENUMBER_FAILED");
  }
};

const renumberSetsDense = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string
): Promise<void> => {
  const rows = await fetchSetOrderRows(supabaseUrl, serviceRoleKey, workoutExerciseId);
  for (let index = 0; index < rows.length; index += 1) {
    const expected = index + 1;
    if (rows[index].set_number === expected) {
      continue;
    }

    await updateSetNumber(supabaseUrl, serviceRoleKey, workoutExerciseId, rows[index].id, expected);
  }
};

const fetchSessionWorkoutExerciseIds = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  workoutExerciseIds: string[]
): Promise<string[]> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      select: "id",
      session_id: `eq.${sessionId}`,
      id: buildInFilter(workoutExerciseIds)
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_FILTER_LOOKUP_FAILED");
  }

  const rows = (await response.json()) as WorkoutExerciseRow[];
  return rows.map((row) => row.id);
};

const deleteSessionWorkoutExercises = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  workoutExerciseIds: string[]
): Promise<void> => {
  if (workoutExerciseIds.length === 0) {
    return;
  }

  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      session_id: `eq.${sessionId}`,
      id: buildInFilter(workoutExerciseIds)
    }),
    {
      method: "DELETE",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_DELETE_FAILED");
  }
};

const fetchSessionExerciseOrderRows = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string
): Promise<WorkoutExerciseOrderRow[]> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      select: "id,order_index",
      session_id: `eq.${sessionId}`,
      order: "order_index.asc"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_ORDER_FETCH_FAILED");
  }

  return (await response.json()) as WorkoutExerciseOrderRow[];
};

const updateWorkoutExerciseOrderIndex = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
  workoutExerciseId: string,
  orderIndex: number
): Promise<void> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_exercises", {
      id: `eq.${workoutExerciseId}`,
      session_id: `eq.${sessionId}`
    }),
    {
      method: "PATCH",
      headers: createServiceHeaders(serviceRoleKey),
      body: JSON.stringify({
        order_index: orderIndex
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_RENUMBER_FAILED");
  }
};

const compactSessionExerciseOrder = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string
): Promise<void> => {
  const rows = await fetchSessionExerciseOrderRows(supabaseUrl, serviceRoleKey, sessionId);
  for (let index = 0; index < rows.length; index += 1) {
    const expected = index + 1;
    if (rows[index].order_index === expected) {
      continue;
    }

    await updateWorkoutExerciseOrderIndex(supabaseUrl, serviceRoleKey, sessionId, rows[index].id, expected);
  }
};

const addWorkoutExerciseWithDefaults = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: AddWorkoutExercisePayload,
  principalId: string
): Promise<WorkoutExerciseRpcRow> => {
  const response = await fetch(buildRestUrl(supabaseUrl, "rpc/add_workout_exercise_with_defaults"), {
    method: "POST",
    headers: {
      ...createServiceHeaders(serviceRoleKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      p_session_id: payload.sessionId,
      p_exercise_id: payload.exerciseId,
      p_user_id: principalId
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("WORKOUT_EXERCISE_ADD_RPC_FAILED");
  }

  const rows = (await response.json()) as WorkoutExerciseRpcRow[];
  const result = rows[0];
  if (!result) {
    throw new Error("WORKOUT_EXERCISE_ADD_RPC_EMPTY");
  }

  return result;
};

const startPushDayWorkoutSession = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  principalId: string
): Promise<StartWorkoutSessionRpcRow> => {
  const response = await fetch(buildRestUrl(supabaseUrl, "rpc/start_push_day_workout_session"), {
    method: "POST",
    headers: {
      ...createServiceHeaders(serviceRoleKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify({ p_user_id: principalId }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("WORKOUT_SESSION_START_RPC_FAILED");
  }

  const rows = (await response.json()) as StartWorkoutSessionRpcRow[];
  const result = rows[0];
  if (!result || !result.session_id || (result.outcome !== "created" && result.outcome !== "already_active")) {
    throw new Error("WORKOUT_SESSION_START_RPC_INVALID_RESPONSE");
  }

  return result;
};

const fetchAddedWorkoutSets = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  workoutExerciseId: string
): Promise<AddedWorkoutSet[]> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "workout_sets", {
      select: "id,workout_exercise_id,set_number,set_type,weight_lbs,reps,rir,completed,completed_at,created_at",
      workout_exercise_id: `eq.${workoutExerciseId}`,
      order: "set_number.asc"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("ADDED_WORKOUT_SET_FETCH_FAILED");
  }

  return ((await response.json()) as WorkoutSetApiRow[]).map((row) => ({
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number,
    setType: row.set_type,
    weightLbs: row.weight_lbs,
    reps: row.reps,
    rir: row.rir,
    completed: row.completed,
    completedAt: row.completed_at,
    createdAt: row.created_at
  }));
};

const fetchExerciseCatalogSummary = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  exerciseId: string
): Promise<ExerciseCatalogSummary> => {
  const response = await fetch(
    buildRestUrl(supabaseUrl, "exercises", {
      select:
        "id,name,slug,muscle_groups,equipment,category,difficulty,tracking_type,default_sets,default_reps,is_bodyweight",
      id: `eq.${exerciseId}`,
      is_active: "eq.true",
      limit: "1"
    }),
    {
      method: "GET",
      headers: createServiceHeaders(serviceRoleKey, false),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("ADDED_EXERCISE_CATALOG_FETCH_FAILED");
  }

  const row = ((await response.json()) as ExerciseCatalogApiRow[])[0];
  if (!row) {
    throw new Error("ADDED_EXERCISE_CATALOG_MISSING");
  }

  return {
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
  };
};

const toAddedWorkoutExercise = (row: WorkoutExerciseRpcRow): AddedWorkoutExercise | null => {
  if (
    !row.workout_exercise_id ||
    !row.session_id ||
    !row.exercise_id ||
    row.order_index === null ||
    !row.created_at
  ) {
    return null;
  }

  return {
    id: row.workout_exercise_id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index,
    supersetGroupId: row.superset_group_id,
    createdAt: row.created_at
  };
};

const parseCompleteSetPayload = (payload: unknown): CompleteSetPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const workoutExerciseId = payload.workoutExerciseId;
  const setId = payload.setId;
  const setNumber = payload.setNumber;
  const setType = payload.setType;
  const weightLbs = payload.weightLbs;
  const reps = payload.reps;
  const rir = payload.rir;
  const completedAt = payload.completedAt;

  if (
    !isNonBlankString(workoutExerciseId) ||
    !isNonBlankString(setId) ||
    typeof setNumber !== "number" ||
    !Number.isInteger(setNumber) ||
    setNumber <= 0 ||
    !isValidSetType(setType) ||
    !isNullableNumber(weightLbs) ||
    !isValidRir(rir) ||
    typeof reps !== "number" ||
    !Number.isInteger(reps) ||
    reps <= 0 || // product lock: completed set requires reps > 0
    !isNonBlankString(completedAt)
  ) {
    return null;
  }

  return {
    workoutExerciseId: workoutExerciseId.trim(),
    setId: setId.trim(),
    setNumber,
    setType,
    weightLbs,
    reps,
    rir,
    completedAt: completedAt.trim()
  };
};

const parseAddSetPayload = (payload: unknown): AddSetPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const workoutExerciseId = payload.workoutExerciseId;
  const weightLbs = payload.weightLbs;
  const reps = payload.reps;
  const setType = payload.setType;

  if (!isNonBlankString(workoutExerciseId) || !isNullableNumber(weightLbs) || !isNullableNumber(reps)) {
    return null;
  }

  if (setType !== undefined && !isValidSetType(setType)) {
    return null;
  }

  return {
    workoutExerciseId: workoutExerciseId.trim(),
    weightLbs,
    reps,
    setType
  };
};

const parseUpdateSetPayload = (payload: unknown): UpdateSetPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const workoutExerciseId = payload.workoutExerciseId;
  const setId = payload.setId;
  const weightLbs = payload.weightLbs;
  const reps = payload.reps;
  const rir = payload.rir;
  const setType = payload.setType;

  if (
    !isNonBlankString(workoutExerciseId) ||
    !isNonBlankString(setId) ||
    !isNullableNumber(weightLbs) ||
    !isNullableNumber(reps) ||
    !isValidRir(rir) ||
    !isValidSetType(setType)
  ) {
    return null;
  }

  if (typeof reps === "number" && (!Number.isInteger(reps) || reps < 0)) {
    return null;
  }

  return {
    workoutExerciseId: workoutExerciseId.trim(),
    setId: setId.trim(),
    weightLbs,
    reps,
    rir,
    setType
  };
};

const parseDeleteSetPayload = (payload: unknown): DeleteSetPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const workoutExerciseId = payload.workoutExerciseId;
  const setId = payload.setId;
  if (!isNonBlankString(workoutExerciseId) || !isNonBlankString(setId)) {
    return null;
  }

  return {
    workoutExerciseId: workoutExerciseId.trim(),
    setId: setId.trim()
  };
};

const parseDeleteWorkoutExercisesPayload = (payload: unknown): DeleteWorkoutExercisesPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const sessionId = payload.sessionId;
  const workoutExerciseIds = payload.workoutExerciseIds;

  if (!isNonBlankString(sessionId) || !Array.isArray(workoutExerciseIds) || workoutExerciseIds.length === 0) {
    return null;
  }

  const normalizedIds = workoutExerciseIds
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  if (normalizedIds.length !== workoutExerciseIds.length) {
    return null;
  }

  return {
    sessionId: sessionId.trim(),
    workoutExerciseIds: [...new Set(normalizedIds)]
  };
};

const parseAddWorkoutExercisePayload = (payload: unknown): AddWorkoutExercisePayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const sessionId = payload.sessionId;
  const exerciseId = payload.exerciseId;
  if (
    !isNonBlankString(sessionId) ||
    !isNonBlankString(exerciseId) ||
    !UUID_PATTERN.test(sessionId) ||
    !UUID_PATTERN.test(exerciseId)
  ) {
    return null;
  }

  return {
    sessionId: sessionId.trim(),
    exerciseId: exerciseId.trim()
  };
};

const parseFinishWorkoutSessionPayload = (payload: unknown): FinishWorkoutSessionPayload | null => {
  if (!isObject(payload)) {
    return null;
  }

  const sessionId = payload.sessionId;
  if (!isNonBlankString(sessionId) || !UUID_PATTERN.test(sessionId)) {
    return null;
  }

  return { sessionId: sessionId.trim() };
};

const parseStartWorkoutSessionPayload = (payload: unknown): StartWorkoutSessionPayload | null => {
  if (payload === undefined) {
    return {};
  }

  return isObject(payload) && Object.keys(payload).length === 0 ? {} : null;
};

const parseMutationRequest = (body: MutationRequestBody): ParsedMutationRequest | null => {
  if (!allowedActions.includes(body.action as MutationAction)) {
    return null;
  }

  if (body.action === "complete_set") {
    const payload = parseCompleteSetPayload(body.payload);
    return payload ? { action: "complete_set", payload } : null;
  }

  if (body.action === "add_set") {
    const payload = parseAddSetPayload(body.payload);
    return payload ? { action: "add_set", payload } : null;
  }

  if (body.action === "update_set") {
    const payload = parseUpdateSetPayload(body.payload);
    return payload ? { action: "update_set", payload } : null;
  }

  if (body.action === "delete_set") {
    const payload = parseDeleteSetPayload(body.payload);
    return payload ? { action: "delete_set", payload } : null;
  }

  if (body.action === "delete_workout_exercises") {
    const payload = parseDeleteWorkoutExercisesPayload(body.payload);
    return payload ? { action: "delete_workout_exercises", payload } : null;
  }

  if (body.action === "add_workout_exercise") {
    const payload = parseAddWorkoutExercisePayload(body.payload);
    return payload ? { action: "add_workout_exercise", payload } : null;
  }

  if (body.action === "finish_workout_session") {
    const payload = parseFinishWorkoutSessionPayload(body.payload);
    return payload ? { action: "finish_workout_session", payload } : null;
  }

  if (body.action === "start_workout_session") {
    const payload = parseStartWorkoutSessionPayload(body.payload);
    return payload ? { action: "start_workout_session", payload } : null;
  }

  return null;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  let env;
  try {
    env = getAuthEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "AUTH_ENV_INVALID" }, { status: 500 });
  }

  const token = request.cookies.get(env.appSessionCookieName)?.value;
  const sessionCheck = verifyAppSessionToken(token, env.appSessionSecret);
  if (!sessionCheck.ok || !sessionCheck.payload) {
    return unauthorizedResponse();
  }

  let body: MutationRequestBody;
  try {
    body = (await request.json()) as MutationRequestBody;
  } catch {
    return invalidInputResponse();
  }

  const parsedRequest = parseMutationRequest(body);
  if (!parsedRequest) {
    return invalidInputResponse();
  }

  switch (parsedRequest.action) {
    case "complete_set": {
      const reps = parsedRequest.payload.reps;
      if (typeof reps !== "number" || reps <= 0 || !isValidIsoDateTime(parsedRequest.payload.completedAt)) {
        return invalidInputResponse();
      }

      try {
        const workoutExercise = await loadWorkoutExerciseOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );
        if (!workoutExercise) {
          return notFoundResponse();
        }

        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const hasSet = await checkWorkoutSetExists(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId,
          parsedRequest.payload.setId
        );
        if (!hasSet) {
          return notFoundResponse();
        }

        const updated = await updateCompletedSet(env.supabaseUrl, env.supabaseServiceRoleKey, parsedRequest.payload);
        if (!updated) {
          return notFoundResponse();
        }

        return NextResponse.json({ ok: true, action: "complete_set" });
      } catch {
        return mutationFailedResponse();
      }
    }
    case "add_set":
      try {
        const workoutExercise = await loadWorkoutExerciseOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );
        if (!workoutExercise) {
          return notFoundResponse();
        }

        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const highestSetNumber = await fetchHighestSetNumber(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );
        const createdSet = await insertSet(env.supabaseUrl, env.supabaseServiceRoleKey, parsedRequest.payload, highestSetNumber + 1);

        return NextResponse.json({
          ok: true,
          action: "add_set",
          data: {
            set: createdSet
          }
        });
      } catch {
        return mutationFailedResponse();
      }
    case "update_set":
      try {
        const workoutExercise = await loadWorkoutExerciseOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );
        if (!workoutExercise) {
          return notFoundResponse();
        }

        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const setState = await loadWorkoutSetState(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId,
          parsedRequest.payload.setId
        );
        if (!setState) {
          return notFoundResponse();
        }

        if (
          setState.completed &&
          (typeof parsedRequest.payload.reps !== "number" || parsedRequest.payload.reps <= 0)
        ) {
          return invalidInputResponse();
        }

        const updated = await updateSetValues(env.supabaseUrl, env.supabaseServiceRoleKey, parsedRequest.payload);
        if (!updated) {
          return notFoundResponse();
        }

        return NextResponse.json({ ok: true, action: "update_set" });
      } catch {
        return mutationFailedResponse();
      }
    case "delete_set":
      try {
        const workoutExercise = await loadWorkoutExerciseOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );
        if (!workoutExercise) {
          return notFoundResponse();
        }

        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExercise.session_id,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const deleted = await deleteSetById(env.supabaseUrl, env.supabaseServiceRoleKey, parsedRequest.payload);
        if (!deleted) {
          return notFoundResponse();
        }

        await renumberSetsDense(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.workoutExerciseId
        );

        return NextResponse.json({
          ok: true,
          action: "delete_set"
        });
      } catch {
        return mutationFailedResponse();
      }
    case "delete_workout_exercises":
      try {
        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const deletableIds = await fetchSessionWorkoutExerciseIds(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          parsedRequest.payload.workoutExerciseIds
        );

        await deleteSessionWorkoutExercises(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          deletableIds
        );

        await compactSessionExerciseOrder(env.supabaseUrl, env.supabaseServiceRoleKey, parsedRequest.payload.sessionId);

        return NextResponse.json({
          ok: true,
          action: "delete_workout_exercises",
          data: {
            deletedWorkoutExerciseIds: deletableIds
          }
        });
      } catch {
        return mutationFailedResponse();
      }
    case "start_workout_session":
      try {
        const result = await startPushDayWorkoutSession(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          sessionCheck.payload.sub
        );

        return NextResponse.json({
          ok: true,
          action: "start_workout_session",
          data: {
            outcome: result.outcome,
            sessionId: result.session_id
          }
        });
      } catch {
        return mutationFailedResponse();
      }
    case "finish_workout_session":
      try {
        const isOwner = await verifySessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          sessionCheck.payload.sub
        );
        if (!isOwner) {
          return forbiddenResponse();
        }

        const isActive = await verifyActiveSessionOwnership(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          sessionCheck.payload.sub
        );
        if (!isActive) {
          return sessionNotActiveResponse();
        }

        const workoutExerciseIds = await fetchWorkoutExerciseIdsForSession(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId
        );
        const setStates = await fetchSessionSetStates(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          workoutExerciseIds
        );
        const completedSetCount = setStates.filter((set) => set.completed).length;
        const totalSetCount = setStates.length;
        // A session without logged sets is intentionally partial rather than complete.
        const status = totalSetCount > 0 && completedSetCount === totalSetCount ? "completed" : "incomplete";
        const finished = await finishActiveWorkoutSession(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload.sessionId,
          sessionCheck.payload.sub,
          status,
          new Date().toISOString()
        );
        if (!finished) {
          return sessionNotActiveResponse();
        }

        if (!finished.ended_at) {
          return mutationFailedResponse();
        }

        return NextResponse.json({
          ok: true,
          action: "finish_workout_session",
          data: {
            session: {
              id: finished.id,
              status,
              startedAt: finished.started_at,
              endedAt: finished.ended_at
            },
            exerciseCount: workoutExerciseIds.length,
            completedSetCount,
            totalSetCount
          }
        });
      } catch {
        return mutationFailedResponse();
      }
    case "add_workout_exercise":
      try {
        const result = await addWorkoutExerciseWithDefaults(
          env.supabaseUrl,
          env.supabaseServiceRoleKey,
          parsedRequest.payload,
          sessionCheck.payload.sub
        );

        if (result.outcome === "session_not_found_or_forbidden") {
          return forbiddenResponse();
        }

        if (result.outcome === "session_not_active") {
          return NextResponse.json({ ok: false, error: "SESSION_NOT_ACTIVE" }, { status: 409 });
        }

        if (result.outcome === "exercise_not_found_or_inactive") {
          return NextResponse.json({ ok: false, error: "EXERCISE_UNAVAILABLE" }, { status: 404 });
        }

        if (result.outcome === "duplicate" && result.existing_workout_exercise_id) {
          return NextResponse.json(
            {
              ok: false,
              error: "EXERCISE_ALREADY_IN_SESSION",
              data: {
                workoutExerciseId: result.existing_workout_exercise_id
              }
            },
            { status: 409 }
          );
        }

        if (result.outcome !== "created") {
          return mutationFailedResponse();
        }

        const workoutExercise = toAddedWorkoutExercise(result);
        if (!workoutExercise) {
          return mutationFailedResponse();
        }

        const [sets, exercise] = await Promise.all([
          fetchAddedWorkoutSets(env.supabaseUrl, env.supabaseServiceRoleKey, workoutExercise.id),
          fetchExerciseCatalogSummary(env.supabaseUrl, env.supabaseServiceRoleKey, workoutExercise.exerciseId)
        ]);

        return NextResponse.json({
          ok: true,
          action: "add_workout_exercise",
          data: {
            workoutExercise,
            sets,
            exercise
          }
        });
      } catch {
        return mutationFailedResponse();
      }
    default:
      return invalidInputResponse();
  }
}
