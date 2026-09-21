"use client";

import { useEffect, useState } from "react";

import { addWorkoutExercise, fetchExerciseCatalog } from "@/components/workout/exerciseBrowserClient";
import type { ExerciseCatalogResponse, ExerciseCatalogSummary } from "@/types/exerciseCatalog";

interface ExerciseBrowserProps {
  sessionId: string;
  addedExerciseIds: ReadonlySet<string>;
  onClose: () => void;
  onAddSuccess: () => Promise<void>;
}

const formatTaxonomyValue = (value: string): string => value.replaceAll("_", " ");

const getLoadErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return "Your session has expired. Return to login and try again.";
  }

  return "Could not load exercises. Try again.";
};

const getAddErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return "Your session has expired. Return to login and try again.";
  }

  if (error instanceof Error && error.message === "SESSION_NOT_ACTIVE") {
    return "This workout is no longer active.";
  }

  if (error instanceof Error && error.message === "EXERCISE_UNAVAILABLE") {
    return "This exercise is no longer available.";
  }

  if (error instanceof Error && error.message === "WORKOUT_REFRESH_FAILED") {
    return "Exercise added, but the workout could not refresh. Reload before continuing.";
  }

  return "Could not add exercise. Try again.";
};

export const ExerciseBrowser = ({ sessionId, addedExerciseIds, onClose, onAddSuccess }: ExerciseBrowserProps) => {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [catalog, setCatalog] = useState<ExerciseCatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetchExerciseCatalog({
          q: query.trim() || undefined,
          muscle: muscle || undefined,
          equipment: equipment || undefined,
          limit: 50
        });

        if (active) {
          setCatalog(response);
        }
      } catch (error) {
        if (active) {
          setLoadError(getLoadErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [query, muscle, equipment]);

  const handleAddExercise = async (exercise: ExerciseCatalogSummary) => {
    if (addingExerciseId || addedExerciseIds.has(exercise.id)) {
      return;
    }

    setAddingExerciseId(exercise.id);
    setAddError(null);

    try {
      const response = await addWorkoutExercise({
        sessionId,
        exerciseId: exercise.id
      });

      if (!response.ok) {
        await onAddSuccess();
        return;
      }

      await onAddSuccess();
    } catch (error) {
      setAddError(getAddErrorMessage(error));
    } finally {
      setAddingExerciseId(null);
    }
  };

  const items = catalog?.items ?? [];
  const muscleGroups = catalog?.facets.muscleGroups ?? [];
  const equipmentValues = catalog?.facets.equipment ?? [];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0d0d0d] px-3 py-4 text-[#e8e4dc]">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="mb-3 inline-flex w-fit items-center gap-2 rounded-[3px] border-2 border-[#2e2e2e] px-[14px] py-[6px] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-[#8a8478] hover:border-[#c8922a] hover:text-[#c8922a]"
        >
          <span className="font-data text-[16px]">←</span>
          Back
        </button>

        <header className="border-b-2 border-[#c8922a] pb-3">
          <h2 className="font-display text-[24px] font-bold uppercase tracking-[0.04em] text-[#e8e4dc]">
            Add Exercise
          </h2>
          <p className="mt-1 font-data text-[12px] text-[#8a8478]">Search the active exercise catalog.</p>
        </header>

        <div className="border-b-2 border-[#2e2e2e] py-3">
          <label className="mb-1.5 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
            Search
          </label>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search exercises..."
            className="h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] outline-none placeholder:text-[#4a4740] focus:border-2 focus:border-[#c8922a]"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="mb-1 block font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
                Muscle
              </span>
              <select
                value={muscle}
                onChange={(event) => setMuscle(event.target.value)}
                className="h-9 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-2 font-data text-[12px] text-[#e8e4dc] outline-none focus:border-2 focus:border-[#c8922a]"
              >
                <option value="">All muscles</option>
                {muscleGroups.map((value) => (
                  <option key={value} value={value}>
                    {formatTaxonomyValue(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
                Equipment
              </span>
              <select
                value={equipment}
                onChange={(event) => setEquipment(event.target.value)}
                className="h-9 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-2 font-data text-[12px] text-[#e8e4dc] outline-none focus:border-2 focus:border-[#c8922a]"
              >
                <option value="">All equipment</option>
                {equipmentValues.map((value) => (
                  <option key={value} value={value}>
                    {formatTaxonomyValue(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-3">
          {loadError ? (
            <div className="rounded-[4px] border border-[#b84040] px-3 py-3 font-data text-[13px] text-[#b84040]">
              {loadError}
            </div>
          ) : null}

          {addError ? (
            <div className="mb-2 rounded-[4px] border border-[#b84040] px-3 py-2 font-data text-[12px] text-[#b84040]">
              {addError}
            </div>
          ) : null}

          {isLoading ? (
            <p className="py-6 text-center font-data text-[13px] text-[#8a8478]">Loading exercises...</p>
          ) : null}

          {!isLoading && !loadError && items.length === 0 ? (
            <p className="py-6 text-center font-data text-[13px] text-[#8a8478]">No exercises match these filters.</p>
          ) : null}

          {!isLoading && !loadError ? (
            <div className="overflow-hidden rounded-[4px] border-2 border-[#2e2e2e]">
              {items.map((exercise) => {
                const isAdded = addedExerciseIds.has(exercise.id);
                const isAdding = addingExerciseId === exercise.id;
                const isDisabled = Boolean(addingExerciseId) || isAdded;

                return (
                  <button
                    key={exercise.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => void handleAddExercise(exercise)}
                    className="flex min-h-[62px] w-full items-center gap-3 border-b border-[#2e2e2e] px-3 py-2 text-left last:border-b-0 disabled:cursor-default disabled:opacity-100"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[17px] font-bold uppercase text-[#e8e4dc]">
                        {exercise.name}
                      </span>
                      <span className="mt-1 block truncate font-data text-[11px] text-[#4a4740]">
                        {exercise.muscleGroups.join(" · ")} / {exercise.equipment.map(formatTaxonomyValue).join(", ")}
                      </span>
                    </span>
                    {isAdding ? (
                      <span className="font-data text-[12px] text-[#c8922a]">ADDING</span>
                    ) : isAdded ? (
                      <span className="rounded-[3px] border border-[#4a9e6b] px-2 py-1 font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#4a9e6b]">
                        Added
                      </span>
                    ) : (
                      <span className="font-display text-[15px] font-bold text-[#c8922a]">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
