export interface WorkoutLibraryItem {
  id: string;
  name: string;
  exerciseNames: string[];
}

export interface WorkoutLibraryResponse {
  items: WorkoutLibraryItem[];
}
