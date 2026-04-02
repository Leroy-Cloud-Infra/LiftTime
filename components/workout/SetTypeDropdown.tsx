import React, { useEffect, useMemo, useRef, useState } from "react";

import type { SetType } from "@/types/workout";

export interface SetTypeDropdownProps {
  value: SetType;
  showTags: boolean;
  onChange: (value: SetType) => void;
  onDelete: () => void;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
}

const SET_TYPE_OPTIONS: SetType[] = ["working", "warmup", "drop", "failure"];

const setTypeLabelMap: Record<SetType, string> = {
  working: "WORKING",
  warmup: "WARM-UP",
  drop: "DROP",
  failure: "FAILURE"
};

const tagClassMap: Record<SetType, string> = {
  working: "border-[#2e2e2e] text-[#4a4740]",
  warmup: "border-[#c8922a] text-[#c8922a]",
  drop: "border-[#2e2e2e] text-[#8a8478]",
  failure: "border-[#b84040] text-[#b84040]"
};

export const SetTypeDropdown = ({
  value,
  showTags,
  onChange,
  onDelete: _onDelete,
  triggerContent,
  triggerClassName
}: SetTypeDropdownProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const currentLabel = useMemo(() => setTypeLabelMap[value], [value]);
  const triggerBaseClass = showTags
    ? `h-[22px] rounded-[3px] border px-2 py-[2px] text-[10px] font-display font-medium uppercase tracking-[0.08em] ${tagClassMap[value]}`
    : "inline-flex items-center";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={triggerClassName ? `${triggerBaseClass} ${triggerClassName}` : triggerBaseClass}
      >
        {showTags ? currentLabel : (triggerContent ?? null)}
      </button>

      {open ? (
        <div className="absolute right-0 top-6 z-30 min-w-[156px] rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] p-1">
          {SET_TYPE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex h-7 w-full items-center gap-2 px-2 text-left font-display text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8478]"
            >
              <span className="inline-flex h-[10px] w-[10px] items-center justify-center border border-[#8a8478] text-[8px] leading-none">
                {option === value ? "●" : ""}
              </span>
              {setTypeLabelMap[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
