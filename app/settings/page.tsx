"use client";

import React, { useEffect, useState } from "react";

import type { WorkoutPreferences } from "@/types/workout";

const WORKOUT_PREFERENCES_STORAGE_KEY = "lifetime.workoutPreferences";

const defaultPreferences: Pick<WorkoutPreferences, "showSetTypeTags"> = {
  showSetTypeTags: false
};

const readShowSetTypeTagsPreference = () => {
  if (typeof window === "undefined") {
    return defaultPreferences.showSetTypeTags;
  }

  try {
    const rawPreferences = window.localStorage.getItem(WORKOUT_PREFERENCES_STORAGE_KEY);
    if (!rawPreferences) {
      return defaultPreferences.showSetTypeTags;
    }

    const parsed = JSON.parse(rawPreferences) as Partial<WorkoutPreferences>;
    return parsed.showSetTypeTags ?? defaultPreferences.showSetTypeTags;
  } catch {
    return defaultPreferences.showSetTypeTags;
  }
};

const saveShowSetTypeTagsPreference = (showSetTypeTags: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rawPreferences = window.localStorage.getItem(WORKOUT_PREFERENCES_STORAGE_KEY);
    const parsed = rawPreferences ? (JSON.parse(rawPreferences) as Partial<WorkoutPreferences>) : {};

    const nextPreferences: Partial<WorkoutPreferences> = {
      ...parsed,
      showSetTypeTags
    };

    window.localStorage.setItem(WORKOUT_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
  } catch {
    window.localStorage.setItem(
      WORKOUT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ showSetTypeTags } satisfies Pick<WorkoutPreferences, "showSetTypeTags">)
    );
  }
};

export default function SettingsPage() {
  const [showSetTypeTags, setShowSetTypeTags] = useState(defaultPreferences.showSetTypeTags);

  useEffect(() => {
    setShowSetTypeTags(readShowSetTypeTagsPreference());
  }, []);

  const onToggle = () => {
    setShowSetTypeTags((previous) => {
      const nextValue = !previous;
      saveShowSetTypeTagsPreference(nextValue);
      return nextValue;
    });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] bg-[#0d0d0d] px-3 py-6 text-[#e8e4dc]">
      <section className="rounded-[4px] border border-[#2e2e2e] bg-[#141414] p-3">
        <h1 className="mb-3 font-display text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a8478]">Preferences</h1>

        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-3 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-2 text-left"
          aria-pressed={showSetTypeTags}
        >
          <span className="min-w-0">
            <span className="block font-display text-[12px] font-medium uppercase tracking-[0.08em] text-[#e8e4dc]">
              Show Set Type Tags
            </span>
            <span className="mt-1 block font-data text-[12px] text-[#8a8478]">
              Display set type on all sets including working sets
            </span>
          </span>

          <span
            className={`mt-0.5 inline-flex h-6 w-11 items-center rounded-full border border-[#2e2e2e] p-0.5 transition ${
              showSetTypeTags ? "bg-[#2a1f0a]" : "bg-[#141414]"
            }`}
            aria-hidden="true"
          >
            <span
              className={`h-4 w-4 rounded-full ${showSetTypeTags ? "translate-x-5 bg-[#c8922a]" : "translate-x-0 bg-[#4a4740]"}`}
            />
          </span>
        </button>
      </section>
    </main>
  );
}
