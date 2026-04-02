import React from "react";

export interface ExerciseDetailSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const ExerciseDetailSheet = ({ open, onClose, children }: ExerciseDetailSheetProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute bottom-0 left-1/2 h-[90vh] w-full max-w-[820px] -translate-x-1/2 rounded-t-[6px] border-2 border-[#2e2e2e] bg-[#141414]">
        <div className="flex h-8 items-center justify-center">
          <span className="h-1.5 w-10 rounded-[4px] bg-[#2e2e2e]" />
        </div>
        <div className="h-[calc(100%-32px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
