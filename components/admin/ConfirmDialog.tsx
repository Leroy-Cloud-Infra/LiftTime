"use client";

import React from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel = "REMOVE",
  cancelLabel = "CANCEL",
  onCancel,
  onConfirm
}: ConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(0,0,0,0.6)] px-4" onClick={onCancel}>
      <div
        className="w-full max-w-[280px] rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] px-6 py-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="font-display text-[18px] font-bold uppercase text-[#e8e4dc]">{title}</h3>
        <p className="mt-2 font-data text-[13px] text-[#8a8478]">{body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-[4px] border border-[#2e2e2e] bg-transparent font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 flex-1 rounded-[4px] bg-[#b84040] font-display text-[14px] font-bold uppercase tracking-[0.08em] text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
