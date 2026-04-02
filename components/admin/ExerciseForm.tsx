"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { JsonImport, type ParsedExerciseJson } from "@/components/admin/JsonImport";
import { fetchSingleRow, insertRow, updateRows } from "@/components/admin/supabaseClient";
import type { AdminExercise, ExerciseCategory, ExerciseDifficulty } from "@/types/admin";

const PRIMARY_SECONDARY_MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "traps"
] as const;

const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "band",
  "bench",
  "pullup_bar",
  "dip_bar"
] as const;

interface ExerciseFormState {
  name: string;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  is_active: boolean;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  instructions: string;
  cues: string;
  common_mistakes: string;
  progressive_overload_notes: string;
  beginner_starting_weight_lbs: string;
  increment_lbs: string;
  strength_range: string;
  hypertrophy_range: string;
  endurance_range: string;
  media_url: string;
}

const initialState: ExerciseFormState = {
  name: "",
  category: "compound",
  difficulty: "beginner",
  is_active: true,
  primary_muscles: [],
  secondary_muscles: [],
  equipment: [],
  instructions: "",
  cues: "",
  common_mistakes: "",
  progressive_overload_notes: "",
  beginner_starting_weight_lbs: "",
  increment_lbs: "5",
  strength_range: "1-5",
  hypertrophy_range: "6-12",
  endurance_range: "12-20",
  media_url: ""
};

const parseNumberOrNull = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

const sectionTitleClass = "mb-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]";
const labelClass = "mb-1.5 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]";
const inputClass =
  "h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none";
const textAreaClass =
  "w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-2 font-data text-[14px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none";

export interface ExerciseFormProps {
  mode: "create" | "edit";
  exerciseId?: string;
  requestId?: string;
  prefillName?: string;
}

export const ExerciseForm = ({ mode, exerciseId, requestId, prefillName }: ExerciseFormProps) => {
  const router = useRouter();

  const [state, setState] = useState<ExerciseFormState>({
    ...initialState,
    name: prefillName ?? ""
  });
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== "edit" || !exerciseId) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const item = await fetchSingleRow<AdminExercise>("exercises", {
          select: "*",
          id: `eq.${exerciseId}`
        });

        if (!item) {
          setError("Exercise not found.");
          return;
        }

        setState({
          name: item.name ?? "",
          category: item.category,
          difficulty: item.difficulty,
          is_active: item.is_active,
          primary_muscles: item.primary_muscles ?? [],
          secondary_muscles: item.secondary_muscles ?? [],
          equipment: item.equipment ?? [],
          instructions: item.instructions ?? "",
          cues: item.cues ?? "",
          common_mistakes: item.common_mistakes ?? "",
          progressive_overload_notes: item.progressive_overload_notes ?? "",
          beginner_starting_weight_lbs:
            item.beginner_starting_weight_lbs === null ? "" : String(item.beginner_starting_weight_lbs),
          increment_lbs: String(item.increment_lbs ?? 5),
          strength_range: item.strength_range ?? "1-5",
          hypertrophy_range: item.hypertrophy_range ?? "6-12",
          endurance_range: item.endurance_range ?? "12-20",
          media_url: item.media_url ?? ""
        });
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load exercise.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [exerciseId, mode]);

  const title = useMemo(() => (mode === "edit" ? "EDIT EXERCISE" : "ADD EXERCISE"), [mode]);

  const applyParsedJson = (parsed: ParsedExerciseJson) => {
    setState((previous) => ({
      ...previous,
      name: parsed.name ?? previous.name,
      category: parsed.category ?? previous.category,
      difficulty: parsed.difficulty ?? previous.difficulty,
      is_active: parsed.is_active ?? previous.is_active,
      primary_muscles: parsed.primary_muscles ?? previous.primary_muscles,
      secondary_muscles: parsed.secondary_muscles ?? previous.secondary_muscles,
      equipment: parsed.equipment ?? previous.equipment,
      instructions: parsed.instructions ?? previous.instructions,
      cues: parsed.cues ?? previous.cues,
      common_mistakes: parsed.common_mistakes ?? previous.common_mistakes,
      progressive_overload_notes: parsed.progressive_overload_notes ?? previous.progressive_overload_notes,
      beginner_starting_weight_lbs:
        parsed.beginner_starting_weight_lbs === undefined || parsed.beginner_starting_weight_lbs === null
          ? previous.beginner_starting_weight_lbs
          : String(parsed.beginner_starting_weight_lbs),
      increment_lbs: parsed.increment_lbs === undefined ? previous.increment_lbs : String(parsed.increment_lbs),
      strength_range: parsed.strength_range ?? previous.strength_range,
      hypertrophy_range: parsed.hypertrophy_range ?? previous.hypertrophy_range,
      endurance_range: parsed.endurance_range ?? previous.endurance_range,
      media_url:
        parsed.media_url === undefined || parsed.media_url === null ? previous.media_url : parsed.media_url
    }));
  };

  const toggleInArray = (key: "primary_muscles" | "secondary_muscles" | "equipment", value: string) => {
    setState((previous) => {
      const existing = previous[key];
      const includes = existing.includes(value);
      return {
        ...previous,
        [key]: includes ? existing.filter((item) => item !== value) : [...existing, value]
      };
    });
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!state.name.trim()) {
      errors.name = "Name is required";
    }

    if (!state.category) {
      errors.category = "Category is required";
    }

    if (!state.difficulty) {
      errors.difficulty = "Difficulty is required";
    }

    if (state.primary_muscles.length === 0) {
      errors.primary_muscles = "Select at least one primary muscle";
    }

    if (state.equipment.length === 0) {
      errors.equipment = "Select at least one equipment option";
    }

    const increment = Number(state.increment_lbs);
    if (Number.isNaN(increment) || increment <= 0) {
      errors.increment_lbs = "Increment must be greater than 0";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const onSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Partial<AdminExercise> = {
      name: state.name.trim(),
      category: state.category,
      difficulty: state.difficulty,
      is_active: state.is_active,
      primary_muscles: state.primary_muscles,
      secondary_muscles: state.secondary_muscles,
      equipment: state.equipment,
      instructions: state.instructions.trim() || null,
      cues: state.cues.trim() || null,
      common_mistakes: state.common_mistakes.trim() || null,
      progressive_overload_notes: state.progressive_overload_notes.trim() || null,
      beginner_starting_weight_lbs: parseNumberOrNull(state.beginner_starting_weight_lbs),
      increment_lbs: Number(state.increment_lbs),
      strength_range: state.strength_range.trim() || "1-5",
      hypertrophy_range: state.hypertrophy_range.trim() || "6-12",
      endurance_range: state.endurance_range.trim() || "12-20",
      media_url: state.media_url.trim() || null
    };

    try {
      if (mode === "edit" && exerciseId) {
        await updateRows<AdminExercise>("exercises", { id: `eq.${exerciseId}` }, payload);
      } else {
        await insertRow<AdminExercise>("exercises", payload);
      }

      if (requestId) {
        await updateRows("exercise_requests", { id: `eq.${requestId}` }, { status: "approved" });
      }

      router.push("/admin/exercises");
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save exercise.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 font-data text-[13px] text-[#8a8478]">Loading exercise…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
      <div className="mb-4">
        <div>
          <Link
            href="/admin/exercises"
            className="mb-3 inline-flex items-center gap-2 rounded-[3px] border-2 border-[#2e2e2e] px-[14px] py-[6px] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-[#8a8478] hover:border-[#c8922a] hover:text-[#c8922a]"
          >
            <span className="font-data text-[16px]">←</span>
            BACK
          </Link>
          <h1 className="mb-4 font-display text-[24px] font-bold uppercase text-[#e8e4dc]">{title}</h1>
        </div>
      </div>

      <div className="space-y-4 rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-4">
        <JsonImport onParsed={applyParsedJson} />

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Basic Info</p>

        <div>
          <label className={labelClass}>Name *</label>
          <input
            value={state.name}
            onChange={(event) => setState((previous) => ({ ...previous, name: event.target.value }))}
            className={inputClass}
          />
          {fieldErrors.name ? <p className="mt-1 font-data text-[12px] text-[#b84040]">{fieldErrors.name}</p> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={state.category}
              onChange={(event) =>
                setState((previous) => ({ ...previous, category: event.target.value as ExerciseCategory }))
              }
              className={inputClass}
            >
              <option value="compound">compound</option>
              <option value="isolation">isolation</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Difficulty *</label>
            <select
              value={state.difficulty}
              onChange={(event) =>
                setState((previous) => ({ ...previous, difficulty: event.target.value as ExerciseDifficulty }))
              }
              className={inputClass}
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-2">
          <span className="font-display text-[12px] uppercase tracking-[0.08em] text-[#8a8478]">Is Active</span>
          <input
            type="checkbox"
            checked={state.is_active}
            onChange={(event) => setState((previous) => ({ ...previous, is_active: event.target.checked }))}
            className="h-4 w-4 accent-[#c8922a]"
          />
        </div>

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Muscle Groups</p>

        <div>
          <label className={labelClass}>Primary Muscles *</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {PRIMARY_SECONDARY_MUSCLES.map((muscle) => (
              <label key={`primary-${muscle}`} className="flex items-center gap-2 font-data text-[13px] text-[#8a8478]">
                <input
                  type="checkbox"
                  checked={state.primary_muscles.includes(muscle)}
                  onChange={() => toggleInArray("primary_muscles", muscle)}
                  className="h-4 w-4 accent-[#c8922a]"
                />
                {muscle}
              </label>
            ))}
          </div>
          {fieldErrors.primary_muscles ? (
            <p className="mt-1 font-data text-[12px] text-[#b84040]">{fieldErrors.primary_muscles}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass}>Secondary Muscles</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {PRIMARY_SECONDARY_MUSCLES.map((muscle) => (
              <label key={`secondary-${muscle}`} className="flex items-center gap-2 font-data text-[13px] text-[#8a8478]">
                <input
                  type="checkbox"
                  checked={state.secondary_muscles.includes(muscle)}
                  onChange={() => toggleInArray("secondary_muscles", muscle)}
                  className="h-4 w-4 accent-[#c8922a]"
                />
                {muscle}
              </label>
            ))}
          </div>
        </div>

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Equipment</p>

        <div>
          <label className={labelClass}>Equipment *</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {EQUIPMENT_OPTIONS.map((item) => (
              <label key={item} className="flex items-center gap-2 font-data text-[13px] text-[#8a8478]">
                <input
                  type="checkbox"
                  checked={state.equipment.includes(item)}
                  onChange={() => toggleInArray("equipment", item)}
                  className="h-4 w-4 accent-[#c8922a]"
                />
                {item}
              </label>
            ))}
          </div>
          {fieldErrors.equipment ? <p className="mt-1 font-data text-[12px] text-[#b84040]">{fieldErrors.equipment}</p> : null}
        </div>

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Instructions</p>

        <div>
          <label className={labelClass}>Instructions</label>
          <textarea
            value={state.instructions}
            onChange={(event) => setState((previous) => ({ ...previous, instructions: event.target.value }))}
            className={`${textAreaClass} h-28`}
            placeholder="Step by step instructions..."
          />
        </div>

        <div>
          <label className={labelClass}>Cues</label>
          <textarea
            value={state.cues}
            onChange={(event) => setState((previous) => ({ ...previous, cues: event.target.value }))}
            className={`${textAreaClass} h-24`}
            placeholder="Short coaching cues, one per line"
          />
        </div>

        <div>
          <label className={labelClass}>Common Mistakes</label>
          <textarea
            value={state.common_mistakes}
            onChange={(event) => setState((previous) => ({ ...previous, common_mistakes: event.target.value }))}
            className={`${textAreaClass} h-24`}
            placeholder="Common errors, one per line"
          />
        </div>

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Progressive Overload</p>

        <div>
          <label className={labelClass}>Progressive Overload Notes</label>
          <input
            value={state.progressive_overload_notes}
            onChange={(event) =>
              setState((previous) => ({ ...previous, progressive_overload_notes: event.target.value }))
            }
            className={inputClass}
            placeholder="How to progress this exercise..."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Beginner Starting Weight (lbs)</label>
            <input
              value={state.beginner_starting_weight_lbs}
              onChange={(event) =>
                setState((previous) => ({ ...previous, beginner_starting_weight_lbs: event.target.value }))
              }
              inputMode="decimal"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Increment (lbs) *</label>
            <input
              value={state.increment_lbs}
              onChange={(event) => setState((previous) => ({ ...previous, increment_lbs: event.target.value }))}
              inputMode="decimal"
              className={inputClass}
            />
            {fieldErrors.increment_lbs ? (
              <p className="mt-1 font-data text-[12px] text-[#b84040]">{fieldErrors.increment_lbs}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className={labelClass}>Strength Range</label>
            <input
              value={state.strength_range}
              onChange={(event) => setState((previous) => ({ ...previous, strength_range: event.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Hypertrophy Range</label>
            <input
              value={state.hypertrophy_range}
              onChange={(event) => setState((previous) => ({ ...previous, hypertrophy_range: event.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Endurance Range</label>
            <input
              value={state.endurance_range}
              onChange={(event) => setState((previous) => ({ ...previous, endurance_range: event.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="h-[2px] bg-[#2e2e2e]" />
        <p className={sectionTitleClass}>Media</p>

        <div>
          <label className={labelClass}>Media URL</label>
          <input
            value={state.media_url}
            onChange={(event) => setState((previous) => ({ ...previous, media_url: event.target.value }))}
            className={inputClass}
            placeholder="GIF or video URL (optional)"
          />
          <p className="mt-1 font-data text-[12px] text-[#8a8478]">Leave blank for now — add media later when available</p>
        </div>

        {error ? <p className="font-data text-[13px] text-[#b84040]">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push("/admin/exercises")}
            className="h-11 rounded-[4px] border border-[#2e2e2e] px-4 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onSave();
            }}
            disabled={saving}
            className="h-11 rounded-[4px] bg-[#c8922a] px-4 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-[#0d0d0d] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Exercise"}
          </button>
        </div>
      </div>
    </div>
  );
};
