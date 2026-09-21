import type { SetType } from "@/types/workout";

export type ExerciseCategory = "compound" | "isolation";
export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

export interface ExerciseCatalogSummary {
  id: string;
  name: string;
  slug: string;
  muscleGroups: string[];
  equipment: string[];
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  trackingType: string;
  defaultSets: number;
  defaultReps: number;
  isBodyweight: boolean;
}

export interface ExerciseCatalogQuery {
  q?: string;
  muscle?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}

export interface ExerciseCatalogResponse {
  items: ExerciseCatalogSummary[];
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  facets: {
    muscleGroups: string[];
    equipment: string[];
  };
}

export interface AddWorkoutExerciseRequest {
  sessionId: string;
  exerciseId: string;
}

export interface AddedWorkoutExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  orderIndex: number;
  supersetGroupId: string | null;
  createdAt: string;
}

export interface AddedWorkoutSet {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  setType: SetType;
  weightLbs: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface AddWorkoutExerciseSuccess {
  ok: true;
  action: "add_workout_exercise";
  data: {
    workoutExercise: AddedWorkoutExercise;
    sets: AddedWorkoutSet[];
    exercise: ExerciseCatalogSummary;
  };
}

export interface AddWorkoutExerciseDuplicate {
  ok: false;
  error: "EXERCISE_ALREADY_IN_SESSION";
  data: {
    workoutExerciseId: string;
  };
}

export type AddWorkoutExerciseResponse = AddWorkoutExerciseSuccess | AddWorkoutExerciseDuplicate;
