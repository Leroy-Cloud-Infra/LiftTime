import React from "react";

export interface RestTimerProps {
  remainingSeconds: number;
  onAdjust: (delta: number) => void;
  onStop: () => void;
}

const formatRest = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
};

export const RestTimer = ({ remainingSeconds, onAdjust, onStop }: RestTimerProps) => {
  return (
    <div className="mt-1 flex h-10 items-center justify-center gap-3 border border-[#2e2e2e] bg-[#1c1c1c] px-2">
      <button
        type="button"
        onClick={() => onAdjust(-10)}
        className="font-data text-[13px] uppercase tracking-[0.06em] text-[#8a8478]"
      >
        -10
      </button>
      <span className="min-w-16 text-center font-data text-[22px] text-[#c8922a]">{formatRest(remainingSeconds)}</span>
      <button
        type="button"
        onClick={() => onAdjust(10)}
        className="font-data text-[13px] uppercase tracking-[0.06em] text-[#8a8478]"
      >
        +10
      </button>
      <button type="button" onClick={onStop} className="font-data text-[14px] text-[#8a8478]">
        ✕
      </button>
    </div>
  );
};
