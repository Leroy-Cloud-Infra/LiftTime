"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { fetchRows, updateRows } from "@/components/admin/supabaseClient";
import type { ExerciseRequest, RequestStatus } from "@/types/admin";

type RequestFilter = "all" | RequestStatus;

const statusColor: Record<RequestStatus, string> = {
  pending: "text-[#c8922a] border-[#c8922a]",
  approved: "text-[#4a9e6b] border-[#4a9e6b]",
  rejected: "text-[#b84040] border-[#b84040]"
};

const filterOptions: Array<{ label: string; value: RequestFilter }> = [
  { label: "ALL", value: "all" },
  { label: "PENDING", value: "pending" },
  { label: "APPROVED", value: "approved" },
  { label: "REJECTED", value: "rejected" }
];

export default function AdminRequestsPage() {
  const [items, setItems] = useState<ExerciseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [rejecting, setRejecting] = useState<ExerciseRequest | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchRows<ExerciseRequest>("exercise_requests", {
        select: "*",
        order: "created_at.desc"
      });
      setItems(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load requests.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return items;
    }
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const rejectRequest = async () => {
    if (!rejecting) {
      return;
    }

    try {
      await updateRows<ExerciseRequest>("exercise_requests", { id: `eq.${rejecting.id}` }, { status: "rejected" });
      setItems((previous) =>
        previous.map((item) => (item.id === rejecting.id ? { ...item, status: "rejected" } : item))
      );
      setRejecting(null);
    } catch (rejectError) {
      const message = rejectError instanceof Error ? rejectError.message : "Failed to reject request.";
      setError(message);
      setRejecting(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold uppercase text-[#e8e4dc]">Exercise Requests</h1>
          {pendingCount > 0 ? (
            <p className="mt-1 inline-flex h-6 items-center rounded-[3px] border border-[#c8922a] px-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#c8922a]">
              {pendingCount} Pending
            </p>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`inline-flex h-7 items-center rounded-[4px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] ${
                active ? "border-[#c8922a] text-[#c8922a]" : "border-[#2e2e2e] text-[#4a4740]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="mb-3 font-data text-[13px] text-[#b84040]">{error}</p> : null}

      {loading ? (
        <p className="font-data text-[13px] text-[#8a8478]">Loading requests...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[16px] font-semibold text-[#e8e4dc]">{item.exercise_name}</h2>
                <span
                  className={`inline-flex h-6 items-center rounded-[3px] border px-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] ${statusColor[item.status]}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-2 space-y-1 font-data text-[12px] text-[#4a4740]">
                <p>Requested by: {item.user_email ?? "Unknown"}</p>
                <p>Date submitted: {new Date(item.created_at).toLocaleDateString()}</p>
              </div>

              {item.notes ? <p className="mt-3 font-data text-[13px] text-[#8a8478]">{item.notes}</p> : null}

              {item.reference_link ? (
                <a
                  href={item.reference_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-data text-[13px] text-[#c8922a] underline"
                >
                  Reference Link
                </a>
              ) : null}

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/admin/exercises/new?requestId=${item.id}&name=${encodeURIComponent(item.exercise_name)}`}
                  className="inline-flex h-9 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
                >
                  Approve
                </Link>
                <button
                  type="button"
                  onClick={() => setRejecting(item)}
                  className="inline-flex h-9 items-center rounded-[4px] border border-[#b84040] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b84040]"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}

          {filtered.length === 0 ? (
            <p className="py-5 text-center font-data text-[13px] text-[#4a4740]">No requests for this filter.</p>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(rejecting)}
        title="REJECT REQUEST"
        body={`Reject request for ${rejecting?.exercise_name ?? "this exercise"}?`}
        confirmLabel="REJECT"
        cancelLabel="CANCEL"
        onCancel={() => setRejecting(null)}
        onConfirm={() => {
          void rejectRequest();
        }}
      />
    </div>
  );
}
