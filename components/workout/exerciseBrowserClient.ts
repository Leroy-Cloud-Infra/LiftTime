"use client";

import type {
  AddWorkoutExerciseRequest,
  AddWorkoutExerciseResponse,
  ExerciseCatalogQuery,
  ExerciseCatalogResponse
} from "@/types/exerciseCatalog";

const toSearchParams = (query: ExerciseCatalogQuery): URLSearchParams => {
  const params = new URLSearchParams();

  if (query.q) {
    params.set("q", query.q);
  }
  if (query.muscle) {
    params.set("muscle", query.muscle);
  }
  if (query.equipment) {
    params.set("equipment", query.equipment);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }

  return params;
};

export const fetchExerciseCatalog = async (query: ExerciseCatalogQuery = {}): Promise<ExerciseCatalogResponse> => {
  const params = toSearchParams(query);
  const response = await fetch(`/api/exercises?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    let error = "EXERCISE_CATALOG_FETCH_FAILED";
    try {
      const body = (await response.json()) as { error?: string };
      error = body.error ?? error;
    } catch {
      // Keep the stable fallback error code.
    }
    throw new Error(error);
  }

  return (await response.json()) as ExerciseCatalogResponse;
};

export const addWorkoutExercise = async (
  payload: AddWorkoutExerciseRequest
): Promise<AddWorkoutExerciseResponse> => {
  const response = await fetch("/api/workout/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "add_workout_exercise",
      payload
    })
  });

  let body: AddWorkoutExerciseResponse | { error?: string } | null = null;
  try {
    body = (await response.json()) as AddWorkoutExerciseResponse | { error?: string };
  } catch {
    body = null;
  }

  if (response.status === 409 && body && "error" in body && body.error === "EXERCISE_ALREADY_IN_SESSION") {
    return body as AddWorkoutExerciseResponse;
  }

  if (!response.ok || !body || !("ok" in body) || body.ok !== true) {
    const error = body && "error" in body ? body.error : "MUTATION_FAILED";
    throw new Error(error ?? "MUTATION_FAILED");
  }

  return body;
};
