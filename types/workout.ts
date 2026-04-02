export type SetType = "working" | "warmup" | "drop" | "failure";

export type TrainingGoal = "strength" | "hypertrophy" | "endurance";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type PreferredUnit = "lbs" | "kg";

export type OverloadDirection = "up" | "hold" | "down";

export interface OverloadSuggestion {
  direction: OverloadDirection;
  suggestedWeightLbs: number | null;
  reason: string;
  returnToTraining: boolean;
}

export interface ExerciseLink {
  id: string;
  url: string;
  title: string;
  platform: "youtube" | "tiktok" | "instagram" | "facebook" | "x" | "link";
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weightLbs: number | null;
  reps: number | null;
  setType: SetType;
  completed: boolean;
  completedAt: string | null;
  suggestionDirection: OverloadDirection | null;
  weightEdited: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  equipment: "barbell" | "bodyweight" | "dumbbell" | "cable";
  order: number;
  supersetGroupId: string | null;
  sets: ExerciseSet[];
  repRangeTop: number;
  muscleGroups: string[];
  notes: string;
  instructions: string;
  links: ExerciseLink[];
}

export interface SupersetGroup {
  id: string;
  exerciseIds: [string, string];
}

export interface WorkoutSession {
  id: string;
  name: string | null;
  startedAt: string;
  elapsedSeconds: number;
  restTimer: {
    active: boolean;
    remainingSeconds: number;
    exerciseId: string;
    setId: string;
  } | null;
  exercises: WorkoutExercise[];
  supersetGroups: SupersetGroup[];
}

export interface WorkoutPreferences {
  showSetTypeTags: boolean;
  preferredUnit: PreferredUnit;
  trainingGoal: TrainingGoal;
  experienceLevel: ExperienceLevel;
}

export interface DetailTarget {
  type: "single" | "superset";
  exerciseId: string;
  supersetGroupId: string | null;
}
