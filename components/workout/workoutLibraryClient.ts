"use client";

import type { WorkoutLibraryResponse } from "@/types/workoutLibrary";

export const fetchWorkoutLibrary = async (): Promise<WorkoutLibraryResponse> => {
  const response = await fetch("/api/workout/templates", { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "UNAUTHORIZED" : "WORKOUT_LIBRARY_FETCH_FAILED");
  }
  return (await response.json()) as WorkoutLibraryResponse;
};
