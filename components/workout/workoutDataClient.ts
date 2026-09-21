"use client";

import {
  fetchRows,
  updateRows
} from "@/components/admin/supabaseClient";
import type { SetType } from "@/types/workout";

export interface DbWorkoutSession {
  id: string;
  user_id: string;
  name: string | null;
  status: "active" | "completed" | "incomplete";
  started_at: string;
  ended_at: string | null;
}

export interface DbWorkoutExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  superset_group_id: string | null;
  created_at: string;
}

export interface DbWorkoutSet {
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

export interface DbExerciseCatalog {
  id: string;
  name: string;
  equipment: string[];
  muscle_groups: string[];
  instructions: string[];
  cues: string[];
  progressive_overload_notes: string | null;
}

export interface ActiveWorkoutBootstrapResult {
  active: true;
  session: DbWorkoutSession;
  workoutExercises: DbWorkoutExercise[];
  workoutSets: DbWorkoutSet[];
  exercisesById: Record<string, DbExerciseCatalog>;
}

export interface NoActiveWorkoutBootstrapResult {
  active: false;
}

export type WorkoutBootstrapResult = ActiveWorkoutBootstrapResult | NoActiveWorkoutBootstrapResult;

export interface CompleteSetParams {
  workoutExerciseId: string;
  setId: string;
  setNumber: number;
  setType: SetType;
  weightLbs: number | null;
  reps: number | null;
  rir: number | null;
  completedAt: string;
}

export interface AddSetParams {
  workoutExerciseId: string;
  weightLbs: number | null;
  reps: number | null;
  setType?: SetType;
}

export interface DeleteSetParams {
  workoutExerciseId: string;
  setId: string;
}

export interface UpdateSetParams {
  workoutExerciseId: string;
  setId: string;
  weightLbs: number | null;
  reps: number | null;
  rir: number | null;
  setType: SetType;
}

export interface ReorderWorkoutExercisesParams {
  sessionId: string;
  orderedWorkoutExerciseIds: string[];
}

export interface DeleteWorkoutExercisesParams {
  sessionId: string;
  workoutExerciseIds: string[];
}

export interface FinishWorkoutSessionParams {
  sessionId: string;
}

export interface StartedWorkoutSessionResult {
  outcome: "created" | "already_active";
  sessionId: string;
}

export interface FinishedWorkoutSessionSummary {
  session: {
    id: string;
    status: "completed" | "incomplete";
    startedAt: string;
    endedAt: string;
  };
  exerciseCount: number;
  completedSetCount: number;
  totalSetCount: number;
}

const uniqueStrings = (values: string[]): string[] => {
  return [...new Set(values)];
};

const normalizeSessionOrderIndexes = async (sessionId: string): Promise<void> => {
  const rows = await fetchRows<Pick<DbWorkoutExercise, "id" | "order_index">>("workout_exercises", {
    select: "id,order_index",
    session_id: `eq.${sessionId}`,
    order: "order_index.asc"
  });

  for (let index = 0; index < rows.length; index += 1) {
    const expectedOrder = index + 1;
    if (rows[index].order_index === expectedOrder) {
      continue;
    }

    await updateRows<DbWorkoutExercise>(
      "workout_exercises",
      { id: `eq.${rows[index].id}`, session_id: `eq.${sessionId}` },
      { order_index: expectedOrder }
    );
  }
};

const normalizeSetNumbers = async (workoutExerciseId: string): Promise<void> => {
  const rows = await fetchRows<Pick<DbWorkoutSet, "id" | "set_number">>("workout_sets", {
    select: "id,set_number",
    workout_exercise_id: `eq.${workoutExerciseId}`,
    order: "set_number.asc"
  });

  for (let index = 0; index < rows.length; index += 1) {
    const expectedNumber = index + 1;
    if (rows[index].set_number === expectedNumber) {
      continue;
    }

    await updateRows<DbWorkoutSet>(
      "workout_sets",
      { id: `eq.${rows[index].id}`, workout_exercise_id: `eq.${workoutExerciseId}` },
      { set_number: expectedNumber }
    );
  }
};

export const completeSet = async (params: CompleteSetParams): Promise<void> => {
  if (params.reps === null || params.reps <= 0) {
    throw new Error("INVALID_COMPLETED_SET_REPS");
  }

  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "complete_set",
      payload: {
        workoutExerciseId: params.workoutExerciseId,
        setId: params.setId,
        setNumber: params.setNumber,
        setType: params.setType,
        weightLbs: params.weightLbs,
        reps: params.reps,
        rir: params.rir,
        completedAt: params.completedAt
      }
    })
  });

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }
};

export const addSet = async (params: AddSetParams): Promise<DbWorkoutSet> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "add_set",
      payload: {
        workoutExerciseId: params.workoutExerciseId,
        weightLbs: params.weightLbs,
        reps: params.reps,
        setType: params.setType
      }
    })
  });

  let parsed:
    | {
        ok?: boolean;
        error?: string;
        data?: {
          set?: DbWorkoutSet;
        };
      }
    | null = null;
  try {
    parsed = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: {
        set?: DbWorkoutSet;
      };
    };
  } catch {
    parsed = null;
  }

  const createdSet = parsed?.data?.set;
  if (!response.ok || parsed?.ok !== true || !createdSet) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }

  return createdSet;
};

export const deleteSet = async (params: DeleteSetParams): Promise<void> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "delete_set",
      payload: {
        workoutExerciseId: params.workoutExerciseId,
        setId: params.setId
      }
    })
  });

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }
};

export const updateSet = async (params: UpdateSetParams): Promise<void> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update_set",
      payload: {
        workoutExerciseId: params.workoutExerciseId,
        setId: params.setId,
        weightLbs: params.weightLbs,
        reps: params.reps,
        rir: params.rir,
        setType: params.setType
      }
    })
  });

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }
};

export const reorderWorkoutExercises = async (params: ReorderWorkoutExercisesParams): Promise<void> => {
  const existing = await fetchRows<Pick<DbWorkoutExercise, "id">>("workout_exercises", {
    select: "id",
    session_id: `eq.${params.sessionId}`
  });

  const existingIds = existing.map((row) => row.id);
  const orderedIds = params.orderedWorkoutExerciseIds;

  if (existingIds.length !== orderedIds.length) {
    throw new Error("INVALID_REORDER_PAYLOAD");
  }

  const existingSet = new Set(existingIds);
  if (!orderedIds.every((id) => existingSet.has(id))) {
    throw new Error("INVALID_REORDER_PAYLOAD");
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    await updateRows<DbWorkoutExercise>(
      "workout_exercises",
      {
        id: `eq.${orderedIds[index]}`,
        session_id: `eq.${params.sessionId}`
      },
      {
        order_index: index + 1
      }
    );
  }
};

export const deleteWorkoutExercises = async (params: DeleteWorkoutExercisesParams): Promise<void> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "delete_workout_exercises",
      payload: {
        sessionId: params.sessionId,
        workoutExerciseIds: uniqueStrings(params.workoutExerciseIds)
      }
    })
  });

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }
};

export const finishWorkoutSession = async (
  params: FinishWorkoutSessionParams
): Promise<FinishedWorkoutSessionSummary> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "finish_workout_session",
      payload: {
        sessionId: params.sessionId
      }
    })
  });

  let parsed:
    | {
        ok?: boolean;
        error?: string;
        data?: FinishedWorkoutSessionSummary;
      }
    | null = null;
  try {
    parsed = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: FinishedWorkoutSessionSummary;
    };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true || !parsed.data) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }

  return parsed.data;
};

export const startWorkoutSession = async (): Promise<StartedWorkoutSessionResult> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "start_workout_session",
      payload: {}
    })
  });

  let parsed:
    | {
        ok?: boolean;
        error?: string;
        data?: StartedWorkoutSessionResult;
      }
    | null = null;
  try {
    parsed = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: StartedWorkoutSessionResult;
    };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.ok !== true || !parsed.data) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }

  return parsed.data;
};
