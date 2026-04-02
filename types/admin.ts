export type ExerciseCategory = "compound" | "isolation";
export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface AdminExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  is_active: boolean;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  instructions: string | null;
  cues: string | null;
  common_mistakes: string | null;
  progressive_overload_notes: string | null;
  beginner_starting_weight_lbs: number | null;
  increment_lbs: number;
  strength_range: string;
  hypertrophy_range: string;
  endurance_range: string;
  media_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRequest {
  id: string;
  exercise_name: string;
  user_id: string | null;
  user_email: string | null;
  notes: string | null;
  reference_link: string | null;
  status: RequestStatus;
  created_at: string;
}

export interface AdminUser {
  id: string;
  display_name: string | null;
  email: string;
  experience_level: string | null;
  training_goal: string | null;
  created_at: string;
  last_active_at: string | null;
  is_admin: boolean;
  is_disabled: boolean;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  changes: string[];
  created_at: string;
  is_published: boolean;
}

export interface AdminAuthUser {
  id: string;
  email: string;
}
