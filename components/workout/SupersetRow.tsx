import React from "react";

export interface SupersetRowLine {
  name: string;
  setCount: number;
  weightText: string;
  repsText: string;
  arrow: "↑" | "—" | "↓";
}

export interface SupersetRowProps {
  lineOne: SupersetRowLine;
  lineTwo: SupersetRowLine;
  rowState: "complete" | "current" | "notStarted";
  onPress: () => void;
  onActionPress: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  isEditMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
}

export interface ChainIconProps {
  size?: number;
  className?: string;
}

const arrowClassMap: Record<SupersetRowLine["arrow"], string> = {
  "↑": "text-[#c8922a]",
  "—": "text-[#4a4740]",
  "↓": "text-[#b84040]"
};

const rowClassMap: Record<
  SupersetRowProps["rowState"],
  { bg: string; rail: string | null; name: string; outer: string }
> = {
  complete: { bg: "bg-[#141414]", rail: "bg-[#4a9e6b]", name: "text-[#4a4740]", outer: "" },
  current: {
    bg: "bg-[#1c1c1c]",
    rail: "bg-[#c8922a]",
    name: "text-[#e8e4dc]",
    outer: "border-t-2 border-t-[#c8922a]"
  },
  notStarted: { bg: "bg-[#141414]", rail: null, name: "text-[#e8e4dc]", outer: "" }
};

const TrashIcon = () => {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 3h6l1 2H8l1-2Z" />
      <path d="M7 7v13h10V7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
};

export const ChainIcon = ({ size = 28, className }: ChainIconProps) => {
  return (
    <span
      className={className}
      style={{ fontSize: `${size}px`, lineHeight: 1, display: "inline-block" }}
      aria-hidden="true"
    >
      ⛓
    </span>
  );
};

const SupersetLine = ({ line, nameClass }: { line: SupersetRowLine; nameClass: string }) => {
  const repsLabel = line.repsText.toLowerCase().includes("reps") ? line.repsText : `${line.repsText} reps`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-flex w-6 justify-center font-data text-[16px] leading-none text-[#4a4740]">
          {line.setCount}
        </span>
        <p
          className={`truncate font-display text-[18px] font-bold leading-[1] ${nameClass}`}
          style={{ fontFamily: "Microgramma" }}
        >
          {line.name}
        </p>
      </div>
      <div
        className="mt-[6px] flex items-center justify-center gap-[6px] font-data text-[13px] leading-none"
        style={{ fontFamily: "DM Mono" }}
      >
        <span className="text-[#4a4740]">{line.setCount} sets</span>
        <span className="text-[#4a4740]">·</span>
        <span className="text-[#4a4740]">{line.weightText}</span>
        <span className={arrowClassMap[line.arrow]}>{line.arrow}</span>
        <span className="text-[#4a4740]">·</span>
        <span className="text-[#4a4740]">{repsLabel}</span>
      </div>
    </div>
  );
};

export const SupersetRow = ({
  lineOne,
  lineTwo,
  rowState,
  onPress,
  onActionPress,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isEditMode,
  isSelected,
  isDragging
}: SupersetRowProps) => {
  const classes = rowClassMap[rowState];
  return (
    <div
      onClick={() => {
        if (!isEditMode) {
          onPress();
        }
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex min-h-[80px] w-full items-center border-b border-[#2e2e2e] px-3 py-[10px] text-left ${
        classes.bg
      } ${classes.outer} ${isDragging ? "opacity-60" : ""}`}
    >
      {classes.rail ? <span className={`absolute left-0 top-0 h-full w-[3px] ${classes.rail}`} aria-hidden="true" /> : null}
      <span className="mr-2 flex w-[42px] shrink-0 items-center justify-center self-stretch">
        <ChainIcon size={38} />
      </span>
      <div className="-ml-1 flex-1 space-y-[6px]">
        <SupersetLine line={lineOne} nameClass={classes.name} />
        <SupersetLine line={lineTwo} nameClass={classes.name} />
      </div>

      <span className="ml-2 flex items-center gap-2 self-center">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onActionPress();
          }}
          className={`inline-flex h-[22px] w-[22px] items-center justify-center ${
            isEditMode ? "text-[#4a9e6b]" : "text-[#4a4740] hover:text-[#b84040]"
          } ${isEditMode && !isSelected ? "opacity-40" : ""}`}
          aria-label={isEditMode ? "Select superset" : "Delete superset"}
        >
          {isEditMode ? <span className="font-data text-[16px]">✓</span> : <TrashIcon />}
        </button>

        {isEditMode ? (
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
              }
              onDragStart?.();
            }}
            onDragEnd={() => onDragEnd?.()}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-[22px] w-[22px] items-center justify-center font-data text-[18px] text-[#4a4740]"
            aria-label="Drag superset"
          >
            ⠿
          </button>
        ) : (
          <span className="font-data text-[18px] text-[#4a4740]">›</span>
        )}
      </span>
    </div>
  );
};
