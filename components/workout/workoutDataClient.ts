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
}

export interface CompletedSetResult {
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

export const completeSet = async (params: CompleteSetParams): Promise<CompletedSetResult> => {
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
        rir: params.rir
      }
    })
  });

  let parsed: { ok?: boolean; error?: string; data?: { completedAt?: string | null } } | null = null;
  try {
    parsed = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: { completedAt?: string | null };
    };
  } catch {
    parsed = null;
  }

  const completedAt = parsed?.data?.completedAt;
  if (!response.ok || parsed?.ok !== true || typeof completedAt !== "string" || completedAt.length === 0) {
    throw new Error(parsed?.error ?? "MUTATION_FAILED");
  }

  return { completedAt };
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

export const startWorkoutSession = async (templateId: string): Promise<StartedWorkoutSessionResult> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "start_workout_session",
      payload: { templateId }
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
