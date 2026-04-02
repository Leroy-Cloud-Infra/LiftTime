import React, { useMemo } from "react";

import { SetTypeDropdown } from "@/components/workout/SetTypeDropdown";
import type { ExerciseSet, PreferredUnit, SetType } from "@/types/workout";

export interface SetRowProps {
  set: ExerciseSet;
  isBodyweight: boolean;
  isBarbell: boolean;
  showSetTypeTags: boolean;
  preferredUnit: PreferredUnit;
  onChangeWeight: (weightLbs: number | null, edited: boolean) => void;
  onChangeReps: (reps: number | null) => void;
  onChangeSetType: (setType: SetType) => void;
  onDelete: () => void;
}

const LBS_TO_KG = 0.45359237;

const directionClassMap: Record<"↑" | "—" | "↓", string> = {
  "↑": "text-[#c8922a]",
  "—": "text-[#4a4740]",
  "↓": "text-[#b84040]"
};

const setTypeDotClassMap: Record<SetType, string> = {
  warmup: "bg-[#c8922a]",
  working: "bg-transparent",
  drop: "bg-[#8a8478]",
  failure: "bg-[#b84040]"
};

const formatWeightForInput = (weightLbs: number | null, unit: PreferredUnit) => {
  if (weightLbs === null) {
    return "";
  }

  if (unit === "kg") {
    return (Math.round(weightLbs * LBS_TO_KG * 10) / 10).toString();
  }

  return weightLbs.toString();
};

const parseWeightFromInput = (rawValue: string, unit: PreferredUnit) => {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (unit === "kg") {
    return Math.round((parsed / LBS_TO_KG) * 100) / 100;
  }

  return parsed;
};

const parseIntegerValue = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed);
};

const getDirectionSymbol = (set: ExerciseSet): "↑" | "—" | "↓" | null => {
  if (set.weightEdited) {
    return null;
  }

  if (!set.suggestionDirection || set.suggestionDirection === "hold") {
    return "—";
  }

  if (set.suggestionDirection === "up") {
    return "↑";
  }

  if (set.suggestionDirection === "down") {
    return "↓";
  }

  return "—";
};

export const SetRow = ({
  set,
  isBodyweight: _isBodyweight,
  isBarbell,
  showSetTypeTags,
  preferredUnit,
  onChangeWeight,
  onChangeReps,
  onChangeSetType,
  onDelete
}: SetRowProps) => {
  const weightValue = useMemo(() => formatWeightForInput(set.weightLbs, preferredUnit), [set.weightLbs, preferredUnit]);
  const repsValue = set.reps === null ? "" : String(set.reps);
  const directionSymbol = getDirectionSymbol(set);
  const unitLabel = preferredUnit === "kg" ? "kg" : "lbs";
  const shouldShowDotPicker = !showSetTypeTags;

  return (
    <div className={`flex min-h-[52px] w-full items-center border-b border-[#2e2e2e] px-3 pt-[10px] ${isBarbell ? "pb-[25px]" : "pb-[10px]"}`}>
      {shouldShowDotPicker ? (
        <SetTypeDropdown
          value={set.setType}
          showTags={false}
          onChange={onChangeSetType}
          onDelete={onDelete}
          triggerClassName="mr-2 shrink-0"
          triggerContent={
            <span className="inline-flex w-[38px] items-center justify-start">
              <span className={`h-[6px] w-[6px] rounded-full ${setTypeDotClassMap[set.setType]}`} aria-hidden="true" />
              <span
                className="ml-[6px] inline-flex w-8 items-center justify-center text-center font-display text-[24px] font-bold leading-none text-[#4a4740]"
                style={{ fontFamily: "Microgramma", fontWeight: 700 }}
              >
                {set.setNumber}
              </span>
            </span>
          }
        />
      ) : (
        <span
          className="mr-2 inline-flex w-8 shrink-0 items-center justify-center text-center font-display text-[24px] font-bold leading-none text-[#4a4740]"
          style={{ fontFamily: "Microgramma", fontWeight: 700 }}
        >
          {set.setNumber}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-center">
        <input
          inputMode="numeric"
          value={repsValue}
          onChange={(event) => onChangeReps(parseIntegerValue(event.target.value))}
          readOnly={set.completed}
          className="h-10 w-16 shrink-0 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-1 text-center font-display text-[20px] font-medium text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
          style={{ fontFamily: "Microgramma", fontWeight: 500 }}
        />
        <span className="mx-2 font-data text-[12px] text-[#4a4740]">reps</span>

        <div className="relative shrink-0">
          <input
            inputMode="decimal"
            value={weightValue}
            onChange={(event) => onChangeWeight(parseWeightFromInput(event.target.value, preferredUnit), true)}
            readOnly={set.completed}
            className="h-10 w-20 rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-1 text-center font-display text-[20px] font-medium text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
            style={{ fontFamily: "Microgramma", fontWeight: 500 }}
          />
          {isBarbell ? (
            <span
              className="pointer-events-none absolute left-1/2 top-full mt-[3px] -translate-x-1/2 whitespace-nowrap font-display text-[10px] font-medium uppercase text-[#4a4740]"
              style={{ fontFamily: "Microgramma", fontWeight: 500 }}
            >
              BARBELL + PLATES
            </span>
          ) : null}
        </div>
        <span className="ml-1.5 font-data text-[12px] text-[#4a4740]">{unitLabel}</span>
        {directionSymbol ? (
          <span className={`ml-2 font-data text-[14px] ${directionClassMap[directionSymbol]}`}>{directionSymbol}</span>
        ) : null}

        {showSetTypeTags ? (
          <div className="ml-2">
            <SetTypeDropdown
              value={set.setType}
              showTags
              onChange={onChangeSetType}
              onDelete={onDelete}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex h-[22px] w-[22px] items-center justify-center text-[#4a4740] hover:text-[#b84040]"
          aria-label="Delete set"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 3h6l1 2H8l1-2Z" />
            <path d="M7 7v13h10V7" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
