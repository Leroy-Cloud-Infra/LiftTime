import React, { useEffect, useMemo, useRef, useState } from "react";

import { BarbelAssistPill } from "@/components/workout/BarbelAssistPill";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetRow } from "@/components/workout/SetRow";
import { ChainIcon } from "@/components/workout/SupersetRow";
import type {
  DetailTarget,
  ExerciseSet,
  ExerciseLink,
  SetType,
  WorkoutExercise,
  WorkoutPreferences,
  WorkoutSession
} from "@/types/workout";

export interface PersistSetPayload {
  workoutExerciseId: string;
  setId: string;
  setNumber: number;
  setType: SetType;
  weightLbs: number | null;
  reps: number | null;
  completed: true;
  completedAt: string;
}

export interface ExerciseDetailProps {
  session: WorkoutSession;
  preferences: WorkoutPreferences;
  target: DetailTarget;
  hasMoreExercisesRemaining: boolean;
  isDesktop: boolean;
  onClose: () => void;
  onAdvanceExercise: () => void;
  onFinishWorkout: () => void;
  onSaveSet: (payload: PersistSetPayload) => Promise<void>;
  onUpdateSet: (exerciseId: string, setId: string, patch: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onUpdateExerciseNotes: (exerciseId: string, notes: string) => void;
  onAddExerciseLink: (exerciseId: string, link: ExerciseLink) => void;
  onRemoveExerciseLink: (exerciseId: string, linkId: string) => void;
  onStartRest: (exerciseId: string, setId: string, durationSeconds: number) => void;
  onAdjustRest: (deltaSeconds: number) => void;
  onStopRest: () => void;
}

type ActionPanel = "none" | "history" | "instructions" | "notes";

const getRestByGoal = (goal: WorkoutPreferences["trainingGoal"]) => {
  if (goal === "strength") {
    return 180;
  }

  if (goal === "endurance") {
    return 45;
  }

  return 90;
};

const detectPlatform = (url: string): ExerciseLink["platform"] => {
  const normalized = url.toLowerCase();
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }

  if (normalized.includes("tiktok.com")) {
    return "tiktok";
  }

  if (normalized.includes("instagram.com")) {
    return "instagram";
  }

  if (normalized.includes("facebook.com")) {
    return "facebook";
  }

  if (normalized.includes("x.com") || normalized.includes("twitter.com")) {
    return "x";
  }

  return "link";
};

const getDomainTitle = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "Saved link";
  }
};

const buildSupersetExerciseIds = (target: DetailTarget, session: WorkoutSession) => {
  if (target.type !== "superset" || !target.supersetGroupId) {
    return [target.exerciseId];
  }

  const superset = session.supersetGroups.find((group) => group.id === target.supersetGroupId);
  if (!superset) {
    return [target.exerciseId];
  }

  return [...superset.exerciseIds];
};

const LinkPlatformIcon = ({ platform }: { platform: ExerciseLink["platform"] }) => {
  switch (platform) {
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M23 12.3c0 2.3-.3 4.7-.3 4.7s-.2 1.6-.9 2.4c-.8.9-1.7.9-2.2 1-3.1.2-7.6.2-7.6.2s-5.7-.1-7.4-.2c-.5-.1-1.5-.1-2.3-1-.7-.8-.9-2.4-.9-2.4S1 14.6 1 12.3s.3-4.7.3-4.7.2-1.6.9-2.4c.8-.9 1.8-.9 2.3-1 1.7-.1 7.4-.2 7.4-.2s4.5.1 7.6.2c.5.1 1.4.1 2.2 1 .7.8.9 2.4.9 2.4s.3 2.4.3 4.7ZM10 8.8v6.8l5.9-3.4L10 8.8Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M14.5 3v11.2a3.6 3.6 0 1 1-3.6-3.6c.3 0 .6 0 .9.1V7.1a7.2 7.2 0 1 0 6.3 7.1V9.9a6.9 6.9 0 0 0 3.9 1.2V7.6c-2.2-.1-4.2-1.9-4.8-4.6h-2.7Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm10 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.8-.1-1.5-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4V11H8v3h2.7v8h2.8Z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M18.2 3h2.8l-6.1 7 7.2 11h-5.7l-4.5-7-6.1 7H3l6.6-7.7L2.7 3h5.8l4.1 6.4L18.2 3Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 14 21 3" />
          <path d="M21 9V3h-6" />
          <path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6" />
        </svg>
      );
  }
};

export const ExerciseDetail = ({
  session,
  preferences,
  target,
  hasMoreExercisesRemaining,
  isDesktop,
  onClose,
  onAdvanceExercise,
  onFinishWorkout,
  onSaveSet,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
  onUpdateExerciseNotes,
  onAddExerciseLink,
  onRemoveExerciseLink,
  onStartRest,
  onAdjustRest,
  onStopRest
}: ExerciseDetailProps) => {
  const [actionPanel, setActionPanel] = useState<ActionPanel>("none");
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeTabExerciseId, setActiveTabExerciseId] = useState(target.exerciseId);
  const [pendingLink, setPendingLink] = useState("");
  const [setDeleteDialog, setSetDeleteDialog] = useState<{ setId: string; setNumber: number } | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const explanationRef = useRef<HTMLDivElement>(null);

  const supersetExerciseIds = useMemo(() => buildSupersetExerciseIds(target, session), [target, session]);

  useEffect(() => {
    setActiveTabExerciseId(target.exerciseId);
    setActionPanel("none");
    setShowExplanation(false);
    setSetDeleteDialog(null);
    setCompletionError(null);
  }, [target.exerciseId, target.type]);

  useEffect(() => {
    if (!showExplanation) {
      return;
    }

    const onOutsideClick = (event: MouseEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }

      if (explanationRef.current && !explanationRef.current.contains(targetNode)) {
        setShowExplanation(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [showExplanation]);

  const exerciseById = useMemo(() => {
    return session.exercises.reduce<Record<string, WorkoutExercise>>((accumulator, exercise) => {
      accumulator[exercise.id] = exercise;
      return accumulator;
    }, {});
  }, [session.exercises]);

  const activeExercise = exerciseById[activeTabExerciseId];
  const allTargetExercises = supersetExerciseIds
    .map((exerciseId) => exerciseById[exerciseId])
    .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));

  const allTargetSetsCompleted = allTargetExercises.every((exercise) =>
    exercise.sets.every((set) => set.completed)
  );

  const hasWeightOverride = activeExercise?.sets.some((set) => set.weightEdited) ?? false;
  const suggestionDirection = useMemo<"up" | "down" | "hold">(() => {
    if (!activeExercise) {
      return "hold";
    }

    const upSet = activeExercise.sets.find((set) => set.suggestionDirection === "up");
    if (upSet) {
      return "up";
    }

    const downSet = activeExercise.sets.find((set) => set.suggestionDirection === "down");
    if (downSet) {
      return "down";
    }

    return "hold";
  }, [activeExercise]);

  const suggestionCardText = useMemo(() => {
    if (hasWeightOverride || suggestionDirection === "hold") {
      return null;
    }

    if (suggestionDirection === "down") {
      return "Starting lighter based on your time off. Building back up.";
    }

    const targetWeight = activeExercise?.sets.find((set) => set.suggestionDirection === "up")?.weightLbs ?? null;
    if (targetWeight) {
      return `Last session: 3 x 10 at 135 lbs — try ${targetWeight} lbs today`;
    }

    return "Last session: 3 x 10 at 135 lbs — try 140 lbs today";
  }, [activeExercise, hasWeightOverride, suggestionDirection]);

  const openPanel = (panel: ActionPanel) => {
    setActionPanel((previous) => (previous === panel ? "none" : panel));
  };

  const saveCurrentSet = async (): Promise<boolean> => {
    if (!activeExercise) {
      return false;
    }

    const pendingSet = activeExercise.sets.find((set) => !set.completed);
    if (!pendingSet) {
      return false;
    }

    if (pendingSet.reps === null || pendingSet.reps <= 0) {
      setCompletionError("Reps must be greater than 0 to log a completed set.");
      return false;
    }

    const completedAt = new Date().toISOString();

    try {
      await onSaveSet({
        workoutExerciseId: activeExercise.id,
        setId: pendingSet.id,
        setNumber: pendingSet.setNumber,
        setType: pendingSet.setType,
        weightLbs: pendingSet.weightLbs,
        reps: pendingSet.reps,
        completed: true,
        completedAt
      });
    } catch {
      setCompletionError("Unable to log set right now. Please try again.");
      return false;
    }

    onUpdateSet(activeExercise.id, pendingSet.id, {
      completed: true,
      completedAt
    });
    setCompletionError(null);

    if (target.type === "superset" && supersetExerciseIds.length > 1) {
      const currentTabIndex = supersetExerciseIds.findIndex((exerciseId) => exerciseId === activeExercise.id);

      if (currentTabIndex === supersetExerciseIds.length - 1) {
        onStartRest(activeExercise.id, pendingSet.id, getRestByGoal(preferences.trainingGoal));
        setActiveTabExerciseId(supersetExerciseIds[0]);
      } else {
        setActiveTabExerciseId(supersetExerciseIds[currentTabIndex + 1]);
      }

      return true;
    }

    onStartRest(activeExercise.id, pendingSet.id, getRestByGoal(preferences.trainingGoal));
    return true;
  };

  const primaryActionLabel = allTargetSetsCompleted
    ? hasMoreExercisesRemaining
      ? "NEXT EXERCISE"
      : "FINISH WORKOUT"
    : "LOG SET";

  const onPrimaryAction = async () => {
    if (!allTargetSetsCompleted) {
      await saveCurrentSet();
      return;
    }

    if (hasMoreExercisesRemaining) {
      onAdvanceExercise();
      onClose();
      return;
    }

    onFinishWorkout();
  };

  if (!activeExercise) {
    return null;
  }

  const isRestVisible =
    Boolean(session.restTimer?.active) &&
    Boolean(session.restTimer?.exerciseId === activeExercise.id) &&
    Boolean(session.restTimer?.setId);

  return (
    <div
      className={`relative mx-auto w-full max-w-[420px] border-2 border-[#2e2e2e] bg-[#0d0d0d] text-[#e8e4dc] ${
        isDesktop ? "" : "min-h-dvh"
      }`}
    >
      <div className="sticky top-0 z-20 bg-[#0d0d0d] px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="mb-3 inline-flex items-center gap-2 rounded-[3px] border-2 border-[#2e2e2e] px-[14px] py-[6px] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-[#8a8478] hover:border-[#c8922a] hover:text-[#c8922a]"
        >
          <span className="font-data text-[16px]">←</span>
          BACK
        </button>

        <div className="mb-4 border-b-2 border-[#c8922a] pb-2">
          {target.type === "superset" ? (
            <div className="flex items-center gap-2">
              <ChainIcon size={28} />
              <h1 className="font-display text-[28px] font-bold uppercase leading-[1] text-[#e8e4dc]">Superset</h1>
            </div>
          ) : (
            <h1 className="font-display text-[28px] font-bold uppercase leading-[1] text-[#e8e4dc]">{activeExercise.name}</h1>
          )}
        </div>

        {target.type === "superset" && allTargetExercises.length === 2 ? (
          <div className="mt-0 border-b border-[#2e2e2e] bg-[#141414]">
            <div className="flex h-9 items-center">
              {allTargetExercises.map((exercise) => {
                const active = exercise.id === activeTabExerciseId;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => setActiveTabExerciseId(exercise.id)}
                    className={`flex-1 border-b-[3px] font-display text-[13px] font-semibold uppercase tracking-[0.08em] ${
                      active
                        ? "border-[#c8922a] text-[#c8922a]"
                        : "border-transparent text-[#4a4740]"
                    }`}
                  >
                    {exercise.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          {([
            ["history", "HISTORY"],
            ["instructions", "INSTRUCTIONS"],
            ["notes", "NOTES"]
          ] as const).map(([panelKey, label]) => {
            const active = actionPanel === panelKey;
            return (
              <button
                key={panelKey}
                type="button"
                onClick={() => openPanel(panelKey)}
                className={`h-[30px] rounded-[4px] border px-3 font-display text-[11px] font-medium uppercase tracking-[0.08em] ${
                  active
                    ? "border-[#c8922a] text-[#c8922a]"
                    : "border-[#2e2e2e] bg-[#1c1c1c] text-[#8a8478]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {actionPanel === "history" ? (
          <div className="mt-2 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-3 font-data text-[13px] text-[#8a8478]">
            Exercise history screen stub.
          </div>
        ) : null}

        {actionPanel === "instructions" ? (
          <div className="mt-2 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-3 font-data text-[13px] text-[#8a8478]">
            <p>{activeExercise.instructions || "No instructions added yet."}</p>
            <div className="mt-2 h-16 rounded-[4px] border border-[#2e2e2e] px-2 py-1 text-[#4a4740]">
              Media placeholder
            </div>
          </div>
        ) : null}

        {actionPanel === "notes" ? (
          <div className="mt-2 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-3">
            <textarea
              defaultValue={activeExercise.notes}
              onBlur={(event) => onUpdateExerciseNotes(activeExercise.id, event.target.value)}
              className="h-20 w-full rounded-[4px] border border-[#2e2e2e] bg-[#141414] p-2 font-data text-[13px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
              placeholder="Add notes"
            />
            <div className="mt-2 flex gap-2">
              <input
                value={pendingLink}
                onChange={(event) => setPendingLink(event.target.value)}
                className="h-8 flex-1 rounded-[4px] border border-[#2e2e2e] bg-[#141414] px-2 font-data text-[12px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={() => {
                  const url = pendingLink.trim();
                  if (!url) {
                    return;
                  }

                  onAddExerciseLink(activeExercise.id, {
                    id: `link-${Date.now()}`,
                    url,
                    title: getDomainTitle(url),
                    platform: detectPlatform(url)
                  });
                  setPendingLink("");
                }}
                className="h-8 rounded-[4px] border border-[#2e2e2e] px-2 font-display text-[11px] uppercase tracking-[0.08em] text-[#8a8478]"
              >
                + Add Link
              </button>
            </div>
            {activeExercise.links.length > 0 ? (
              <div className="mt-2 space-y-1">
                {activeExercise.links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between font-data text-[12px] text-[#8a8478]">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[#8a8478]">
                        <LinkPlatformIcon platform={link.platform} />
                      </span>
                      <span>{link.title || getDomainTitle(link.url)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveExerciseLink(activeExercise.id, link.id)}
                      className="text-[#b84040]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeExercise.links.length > 0 ? (
          <div className="mt-1">
            <p className="mb-2.5 mt-1 border-l-2 border-[#c8922a] pl-2 font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
              Links
            </p>
            <div className="flex flex-wrap gap-2">
              {activeExercise.links.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                  className="inline-flex h-[30px] items-center gap-1.5 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-display text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a8478]"
                >
                  <span className="text-[#8a8478]">
                    <LinkPlatformIcon platform={link.platform} />
                  </span>
                  <span>{link.title || getDomainTitle(link.url)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-40 pt-3">
        {suggestionCardText ? (
          <div
            className="mb-2 rounded-[4px] border border-[#c8922a] bg-[#2a1f0a] px-[6px] py-2 font-data text-[11px] text-[#8a8478]"
            style={{ fontFamily: "DM Mono" }}
          >
            {suggestionCardText}
          </div>
        ) : null}

        <div className="mb-2.5 flex items-center justify-between">
          <span className="border-l-2 border-[#c8922a] pl-2 font-display text-[12px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
            Sets
          </span>
          <div className="ml-auto flex items-center gap-2">
            {activeExercise.equipment === "barbell" ? (
              <BarbelAssistPill sets={activeExercise.sets} preferredUnit={preferences.preferredUnit} />
            ) : null}
            <button
              type="button"
              onClick={() => setShowExplanation((previous) => !previous)}
              className="rounded-[3px] border-2 border-[#2e2e2e] px-[6px] py-[2px] font-display text-[12px] font-bold text-[#4a4740] hover:border-[#c8922a] hover:text-[#c8922a]"
              style={{ fontFamily: "Microgramma", fontWeight: 700 }}
            >
              ?
            </button>
          </div>
        </div>

        {showExplanation ? (
          <div
            ref={explanationRef}
            className="mb-2 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-3 font-data text-[13px] text-[#8a8478]"
            style={{ fontFamily: "DM Mono" }}
          >
            <p className="mb-2 uppercase tracking-[0.08em]">Set Indicators</p>
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2">
                <span className="h-[6px] w-[6px] rounded-full bg-[#c8922a]" aria-hidden="true" />
                <span>WARM-UP — set marked as warm-up, excluded from progression tracking</span>
              </p>
              <p className="inline-flex items-center gap-2">
                <span className="h-[6px] w-[6px] rounded-full bg-[#8a8478]" aria-hidden="true" />
                <span>DROP — drop set</span>
              </p>
              <p className="inline-flex items-center gap-2">
                <span className="h-[6px] w-[6px] rounded-full bg-[#b84040]" aria-hidden="true" />
                <span>FAILURE — taken to failure (no dot = working set)</span>
              </p>
            </div>

            <p className="mb-2 uppercase tracking-[0.08em]">How Suggestions Work</p>
            <p>
              LiftTime tracks your last 2 sessions per exercise. If you consistently hit the top of your rep target,
              it suggests a small weight increase next session.
            </p>
            <p className="mt-2">If you override a suggestion, your actual value is saved as real performance data.</p>
            <p className="mt-2">↑ increase suggested · — hold · ↓ reduce</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {activeExercise.sets.map((setRow) => (
            <div key={setRow.id}>
              <SetRow
                set={setRow}
                isBodyweight={activeExercise.equipment === "bodyweight"}
                isBarbell={activeExercise.equipment === "barbell"}
                showSetTypeTags={preferences.showSetTypeTags}
                preferredUnit={preferences.preferredUnit}
                onChangeWeight={(weightLbs, edited) => {
                  if (completionError) {
                    setCompletionError(null);
                  }
                  onUpdateSet(activeExercise.id, setRow.id, {
                    weightLbs,
                    weightEdited: edited
                  });
                }}
                onChangeReps={(reps) => {
                  if (completionError) {
                    setCompletionError(null);
                  }
                  onUpdateSet(activeExercise.id, setRow.id, { reps });
                }}
                onChangeSetType={(setType) => {
                  if (completionError) {
                    setCompletionError(null);
                  }
                  onUpdateSet(activeExercise.id, setRow.id, { setType });
                }}
                onDelete={() => {
                  setSetDeleteDialog({ setId: setRow.id, setNumber: setRow.setNumber });
                }}
              />

              {isRestVisible && session.restTimer?.setId === setRow.id ? (
                <RestTimer
                  remainingSeconds={session.restTimer.remainingSeconds}
                  onAdjust={onAdjustRest}
                  onStop={onStopRest}
                />
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onAddSet(activeExercise.id)}
          className="mt-3 h-[56px] w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-[#8a8478]"
        >
          + Add Set
        </button>
      </div>

      {setDeleteDialog ? (
        <div
          className="fixed inset-0 z-[45] flex items-center justify-center bg-[rgba(0,0,0,0.6)] px-4"
          onClick={() => setSetDeleteDialog(null)}
        >
          <div
            className="w-full max-w-[280px] rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] px-6 py-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-[18px] font-bold uppercase text-[#e8e4dc]">Remove Set</h3>
            <p className="mt-2 font-data text-[13px] text-[#8a8478]">
              Remove Set {setDeleteDialog.setNumber} from this exercise?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSetDeleteDialog(null)}
                className="h-10 flex-1 rounded-[4px] border border-[#2e2e2e] bg-transparent font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSet(activeExercise.id, setDeleteDialog.setId);
                  setSetDeleteDialog(null);
                }}
                className="h-10 flex-1 rounded-[4px] bg-[#b84040] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`z-30 w-full border-t-2 border-[#2e2e2e] bg-[#141414] px-3 pt-2 ${
          isDesktop ? "sticky bottom-0" : "fixed bottom-0 left-1/2 max-w-[420px] -translate-x-1/2"
        }`}
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        {completionError ? (
          <p className="mb-2 font-data text-[12px] text-[#b84040]">{completionError}</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void onPrimaryAction();
          }}
          className={`h-[56px] w-full rounded-[4px] border-2 font-display text-[18px] font-bold uppercase tracking-[0.08em] ${
            primaryActionLabel === "FINISH WORKOUT"
              ? "border-[#4a9e6b] bg-[#4a9e6b] text-white"
              : "border-[#8a6219] bg-[#c8922a] text-[#0d0d0d]"
          }`}
        >
          {primaryActionLabel}
        </button>
      </div>
    </div>
  );
};
