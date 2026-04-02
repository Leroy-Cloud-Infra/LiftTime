import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ExerciseSet, PreferredUnit } from "@/types/workout";

export interface BarbelAssistPillProps {
  sets: ExerciseSet[];
  preferredUnit: PreferredUnit;
}

const LBS_TO_KG = 0.45359237;

const toPreferredUnit = (valueLbs: number, preferredUnit: PreferredUnit) => {
  if (preferredUnit === "kg") {
    return valueLbs * LBS_TO_KG;
  }

  return valueLbs;
};

const formatValue = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return `${Math.round(rounded)}`;
  }

  return rounded.toFixed(1);
};

const formatWeight = (valueLbs: number, preferredUnit: PreferredUnit) => {
  const unitLabel = preferredUnit === "kg" ? "kg" : "lbs";
  return `${formatValue(toPreferredUnit(valueLbs, preferredUnit))} ${unitLabel}`;
};

const getPerSideLoadLbs = (totalWeightLbs: number) => {
  return Math.max((totalWeightLbs - 45) / 2, 0);
};

const buildSideText = (totalWeightLbs: number, preferredUnit: PreferredUnit) => {
  const barSide = toPreferredUnit(45, preferredUnit);
  const perSideLoad = toPreferredUnit(getPerSideLoadLbs(totalWeightLbs), preferredUnit);
  return `${formatValue(barSide)} + ${formatValue(perSideLoad)} each side`;
};

export const BarbelAssistPill = ({ sets, preferredUnit }: BarbelAssistPillProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    return sets
      .filter((set): set is ExerciseSet & { weightLbs: number } => set.weightLbs !== null)
      .map((set) => ({
        id: set.id,
        label: `SET ${set.setNumber}`,
        totalWeightText: formatWeight(set.weightLbs, preferredUnit),
        sideText: buildSideText(set.weightLbs, preferredUnit)
      }));
  }, [preferredUnit, sets]);

  useEffect(() => {
    const closeOnOutsideClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-6 items-center rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-2 font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]"
      >
        Barbell Assist
      </button>

      {open ? (
        <div className="absolute right-0 top-7 z-30 min-w-[280px] rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-3">
          <p className="font-data text-[11px] uppercase tracking-[0.08em] text-[#8a8478]">Plate Breakdown</p>
          <div className="mt-2 space-y-1">
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[44px_auto_1fr] items-center gap-2 font-data text-[12px] text-[#8a8478]">
                <span>{row.label}</span>
                <span>{row.totalWeightText}</span>
                <span className="text-right">{row.sideText}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-data text-[12px] text-[#8a8478]">Standard 45 lb Olympic bar</p>
        </div>
      ) : null}
    </div>
  );
};
