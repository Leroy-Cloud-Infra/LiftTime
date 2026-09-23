import React, { useMemo, useRef, useState } from "react";

import { SetTypeDropdown } from "@/components/workout/SetTypeDropdown";
import type { ExerciseSet, PreferredUnit, SetType } from "@/types/workout";

export interface SetRowProps {
  set: ExerciseSet;
  isBodyweight: boolean;
  isBarbell: boolean;
  isNextIncomplete: boolean;
  showSetTypeTags: boolean;
  preferredUnit: PreferredUnit;
  onChangeWeight: (weightLbs: number | null, edited: boolean) => void;
  onChangeReps: (reps: number | null) => void;
  onChangeSetType: (setType: SetType) => Promise<void>;
  onChangeRir: (rir: number | null) => void;
  onCommitEdit: (payload: { reps: number | null; weightLbs: number | null; setType: SetType; rir: number | null }) => Promise<void>;
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

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

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
  isNextIncomplete,
  showSetTypeTags,
  preferredUnit,
  onChangeWeight,
  onChangeReps,
  onChangeSetType,
  onChangeRir,
  onCommitEdit,
  onDelete
}: SetRowProps) => {
  const weightValue = useMemo(() => formatWeightForInput(set.weightLbs, preferredUnit), [set.weightLbs, preferredUnit]);
  const repsValue = set.reps === null ? "" : String(set.reps);
  const directionSymbol = getDirectionSymbol(set);
  const unitLabel = preferredUnit === "kg" ? "kg" : "lbs";
  const shouldShowDotPicker = !showSetTypeTags;
  const repsInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [isRirPickerOpen, setIsRirPickerOpen] = useState(false);
  const [isSavingRir, setIsSavingRir] = useState(false);
  const [rirSaveError, setRirSaveError] = useState<string | null>(null);
  const [isSavingSetType, setIsSavingSetType] = useState(false);
  const [setTypeSaveError, setSetTypeSaveError] = useState<string | null>(null);
  const commitCurrentValues = () => {
    void onCommitEdit({
      reps: parseIntegerValue(repsInputRef.current?.value ?? repsValue),
      weightLbs: parseWeightFromInput(weightInputRef.current?.value ?? weightValue, preferredUnit),
      setType: set.setType,
      rir: set.rir
    }).catch(() => undefined);
  };
  const selectRir = async (rir: number | null) => {
    if (isSavingRir) {
      return;
    }

    setRirSaveError(null);
    if (!set.completed) {
      onChangeRir(rir);
      setIsRirPickerOpen(false);
      return;
    }

    setIsSavingRir(true);
    try {
      await onCommitEdit({
        reps: set.reps,
        weightLbs: set.weightLbs,
        setType: set.setType,
        rir
      });
      onChangeRir(rir);
      setIsRirPickerOpen(false);
    } catch {
      setRirSaveError("NOT SAVED");
    } finally {
      setIsSavingRir(false);
    }
  };
  const selectSetType = async (setType: SetType) => {
    if (isSavingSetType || setType === set.setType) {
      return;
    }

    setSetTypeSaveError(null);
    setIsSavingSetType(true);
    try {
      await onChangeSetType(setType);
    } catch {
      setSetTypeSaveError("NOT SAVED");
    } finally {
      setIsSavingSetType(false);
    }
  };
  const rowStateClass = set.completed
    ? "bg-[#101010]"
    : isNextIncomplete
      ? "border-l-2 border-l-[#c8922a] bg-[#1c1c1c]"
      : "";
  const inputStateClass = set.completed ? "border-[#4a9e6b] text-[#8a8478]" : "border-[#2e2e2e] text-[#e8e4dc]";
  const statusSlot = set.completed ? (
    <span className="inline-flex w-[46px] shrink-0 flex-col items-center justify-center text-[#4a9e6b]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="m5 12 4 4 10-10" />
      </svg>
      <span className="mt-[2px] font-display text-[8px] font-bold uppercase leading-none tracking-[0.08em]">Done</span>
    </span>
  ) : shouldShowDotPicker ? (
    <SetTypeDropdown
      value={set.setType}
      showTags={false}
      onChange={(setType) => {
        void selectSetType(setType);
      }}
      onDelete={onDelete}
      disabled={isSavingSetType}
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
  );

  return (
    <div className={`w-full border-b border-[#2e2e2e] ${rowStateClass}`}>
      <div className={`flex min-h-[52px] items-center px-3 pt-[10px] ${isBarbell ? "pb-[25px]" : "pb-[10px]"}`}>
        {statusSlot}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-y-1">
        <input
          ref={repsInputRef}
          inputMode="numeric"
          value={repsValue}
          onChange={(event) => onChangeReps(parseIntegerValue(event.target.value))}
          onBlur={commitCurrentValues}
          aria-label={`Set ${set.setNumber} reps${set.completed ? ", completed" : ""}`}
          className={`h-10 w-16 shrink-0 rounded-[4px] border bg-[#1c1c1c] px-1 text-center font-display text-[20px] font-medium focus:border-2 focus:border-[#c8922a] focus:outline-none ${inputStateClass}`}
          style={{ fontFamily: "Microgramma", fontWeight: 500 }}
        />
        <span className="mx-2 font-data text-[12px] text-[#4a4740]">reps</span>

        <div className="relative shrink-0">
          <input
            ref={weightInputRef}
            inputMode="decimal"
            value={weightValue}
            onChange={(event) => onChangeWeight(parseWeightFromInput(event.target.value, preferredUnit), true)}
            onBlur={commitCurrentValues}
            aria-label={`Set ${set.setNumber} weight${set.completed ? ", completed" : ""}`}
            className={`h-10 w-20 rounded-[4px] border bg-[#1c1c1c] px-1 text-center font-display text-[20px] font-medium focus:border-2 focus:border-[#c8922a] focus:outline-none ${inputStateClass}`}
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

        <button
          type="button"
          onClick={() => {
            if (!isSavingRir) {
              setRirSaveError(null);
              setIsRirPickerOpen((previous) => !previous);
            }
          }}
          disabled={isSavingRir}
          aria-expanded={isRirPickerOpen}
          aria-label={`Set ${set.setNumber} RIR${set.rir === null ? ", not recorded" : `, ${set.rir}`}`}
          className="ml-2 inline-flex h-8 shrink-0 items-center gap-1 border border-[#2e2e2e] px-2 text-[#8a8478] hover:border-[#c8922a] hover:text-[#c8922a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="font-display text-[10px] font-medium uppercase tracking-[0.06em]">RIR</span>
          <span className="font-data text-[12px]">{set.rir === null ? "—" : set.rir}</span>
        </button>

        {showSetTypeTags ? (
          <div className="ml-2">
            <SetTypeDropdown
              value={set.setType}
              showTags
              onChange={(setType) => {
                void selectSetType(setType);
              }}
              onDelete={onDelete}
              disabled={isSavingSetType}
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

      {isRirPickerOpen ? (
        <div className="ml-[46px] mr-3 border-t border-[#2e2e2e] pb-3 pt-2">
          <p className="mb-2 font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
            Reps In Reserve
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {RIR_OPTIONS.map((rir) => {
              const isSelected = set.rir === rir;
              return (
                <button
                  key={rir}
                  type="button"
                  onClick={() => {
                    void selectRir(rir);
                  }}
                  disabled={isSavingRir}
                  className={`h-9 border font-data text-[14px] ${
                    isSelected
                      ? "border-[#c8922a] bg-[#2a1f0a] text-[#c8922a]"
                      : "border-[#2e2e2e] bg-[#1c1c1c] text-[#8a8478] focus-visible:border-[#c8922a] focus-visible:text-[#c8922a]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {rir}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              void selectRir(null);
            }}
            disabled={isSavingRir}
            className="mt-2 h-8 w-full border border-[#2e2e2e] font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8478] hover:border-[#c8922a] hover:text-[#c8922a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear RIR
          </button>
          {rirSaveError ? (
            <p className="mt-2 font-data text-[11px] text-[#b84040]" role="alert">
              {rirSaveError}
            </p>
          ) : null}
        </div>
      ) : null}

      {setTypeSaveError ? (
        <p className="px-3 pb-2 font-data text-[11px] text-[#b84040]" role="alert">
          {setTypeSaveError}
        </p>
      ) : null}
    </div>
  );
};
