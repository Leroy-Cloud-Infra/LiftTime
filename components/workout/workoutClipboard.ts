import type { WorkoutSession } from "@/types/workout";

export interface ClipboardWorkoutSummary {
  status: "completed" | "incomplete";
  startedAt: string;
  endedAt: string;
}

const formatDuration = (startedAt: string, endedAt: string): string => {
  const elapsedSeconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const formatNumber = (value: number): string => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const formatLoad = (equipment: WorkoutSession["exercises"][number]["equipment"], weightLbs: number | null): string => {
  if (equipment === "bodyweight") {
    return weightLbs === null || weightLbs === 0 ? "BW" : `BW + ${formatNumber(weightLbs)} lb`;
  }

  return weightLbs === null ? "—" : `${formatNumber(weightLbs)} lb`;
};

const formatSet = (
  exercise: WorkoutSession["exercises"][number],
  set: WorkoutSession["exercises"][number]["sets"][number]
): string => {
  const rirSuffix = set.rir === null ? "" : ` @ ${set.rir} RIR`;
  return `${formatLoad(exercise.equipment, set.weightLbs)} × ${set.reps ?? 0}${rirSuffix}`;
};

export const formatWorkoutForClipboard = (
  session: WorkoutSession,
  summary: ClipboardWorkoutSummary
): string => {
  const lines: string[] = [session.name ?? "Workout", `Status: ${summary.status.toUpperCase()}`, `Duration: ${formatDuration(summary.startedAt, summary.endedAt)}`];

  session.exercises.forEach((exercise) => {
    const completedSets = exercise.sets.filter((set) => set.completed && set.reps !== null && set.reps > 0);
    if (completedSets.length === 0) {
      return;
    }

    lines.push("", exercise.name, ...completedSets.map((set) => formatSet(exercise, set)));
  });

  return lines.join("\n");
};

export const copyWorkoutToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }

  await navigator.clipboard.writeText(text);
};
