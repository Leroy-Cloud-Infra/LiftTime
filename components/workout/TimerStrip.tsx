import React from "react";

export interface TimerStripProps {
  elapsedSeconds: number;
  restActive: boolean;
}

const formatElapsed = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes}:${remainder}`;
  }

  return `${minutes}:${remainder}`;
};

export const TimerStrip = ({ elapsedSeconds, restActive }: TimerStripProps) => {
  return (
    <div
      className={`fixed left-1/2 top-0 z-50 h-11 w-full max-w-[420px] -translate-x-1/2 border-b-2 border-[#2e2e2e] px-3 ${
        restActive ? "border-l-4 border-l-[#c8922a] bg-[#2a1f0a]" : "bg-[#141414]"
      }`}
    >
      <div className="grid h-full grid-cols-[72px_1fr_72px] items-center">
        <span
          className={`font-microgramma font-display text-[11px] uppercase tracking-[0.1em] ${
            restActive ? "font-bold text-[#c8922a]" : "font-medium text-[#4a4740]"
          }`}
        >
          {restActive ? "REST" : "SESSION"}
        </span>
        <span className="text-center font-data text-[20px] text-[#e8e4dc]">{formatElapsed(elapsedSeconds)}</span>
        <span />
      </div>
    </div>
  );
};
