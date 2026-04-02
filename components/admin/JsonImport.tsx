"use client";

import React, { useState } from "react";

export interface ParsedExerciseJson {
  name?: string;
  category?: "compound" | "isolation";
  difficulty?: "beginner" | "intermediate" | "advanced";
  is_active?: boolean;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  equipment?: string[];
  instructions?: string;
  cues?: string;
  common_mistakes?: string;
  progressive_overload_notes?: string;
  beginner_starting_weight_lbs?: number | null;
  increment_lbs?: number;
  strength_range?: string;
  hypertrophy_range?: string;
  endurance_range?: string;
  media_url?: string | null;
}

export interface JsonImportProps {
  onParsed: (value: ParsedExerciseJson) => void;
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const validateParsedJson = (value: unknown): ParsedExerciseJson | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;

  if (obj.name !== undefined && typeof obj.name !== "string") {
    return null;
  }

  if (obj.category !== undefined && obj.category !== "compound" && obj.category !== "isolation") {
    return null;
  }

  if (
    obj.difficulty !== undefined &&
    obj.difficulty !== "beginner" &&
    obj.difficulty !== "intermediate" &&
    obj.difficulty !== "advanced"
  ) {
    return null;
  }

  if (obj.primary_muscles !== undefined && !isStringArray(obj.primary_muscles)) {
    return null;
  }

  if (obj.secondary_muscles !== undefined && !isStringArray(obj.secondary_muscles)) {
    return null;
  }

  if (obj.equipment !== undefined && !isStringArray(obj.equipment)) {
    return null;
  }

  return obj as ParsedExerciseJson;
};

export const JsonImport = ({ onParsed }: JsonImportProps) => {
  const [textValue, setTextValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onParse = () => {
    if (!textValue.trim()) {
      setError("Invalid JSON — check format and try again");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textValue);
    } catch {
      setError("Invalid JSON — check format and try again");
      return;
    }

    const valid = validateParsedJson(parsed);
    if (!valid) {
      setError("Invalid JSON — check format and try again");
      return;
    }

    onParsed(valid);
    setTextValue("");
    setError(null);
  };

  return (
    <section>
      <label className="mb-1.5 block font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
        Import From AI
      </label>
      <textarea
        value={textValue}
        onChange={(event) => {
          setTextValue(event.target.value);
          if (error) {
            setError(null);
          }
        }}
        className="h-[120px] w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-2 font-data text-[13px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
        placeholder="Paste AI-generated JSON here..."
      />
      {error ? <p className="mt-2 font-data text-[12px] text-[#b84040]">{error}</p> : null}
      <button
        type="button"
        onClick={onParse}
        className="mt-2 h-9 rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
      >
        Parse And Fill Form
      </button>
    </section>
  );
};
