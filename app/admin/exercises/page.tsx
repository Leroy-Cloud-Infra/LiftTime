"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { deleteRows, fetchRows, updateRows } from "@/components/admin/supabaseClient";
import type { AdminExercise, ExerciseCategory } from "@/types/admin";

type ActivityFilter = "all" | "active" | "inactive";
type CategoryFilter = "all" | ExerciseCategory;

const categoryFilters: Array<{ label: string; value: CategoryFilter }> = [
  { label: "ALL", value: "all" },
  { label: "COMPOUND", value: "compound" },
  { label: "ISOLATION", value: "isolation" }
];

const activityFilters: Array<{ label: string; value: ActivityFilter }> = [
  { label: "ACTIVE", value: "active" },
  { label: "INACTIVE", value: "inactive" }
];

const filterButtonClass =
  "inline-flex h-7 items-center rounded-[4px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em]";

const compactList = (values: string[], maxCount = 3): string => {
  if (values.length <= maxCount) {
    return values.join(", ");
  }

  return `${values.slice(0, maxCount).join(", ")}…`;
};

export default function AdminExercisesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminExercise[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [deleting, setDeleting] = useState<AdminExercise | null>(null);

  const loadExercises = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchRows<AdminExercise>("exercises", {
        select: "*",
        order: "name.asc"
      });
      setItems(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load exercises.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExercises();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      if (activityFilter === "active" && !item.is_active) {
        return false;
      }

      if (activityFilter === "inactive" && item.is_active) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return item.name.toLowerCase().includes(needle);
    });
  }, [activityFilter, categoryFilter, items, search]);

  const toggleActive = async (exercise: AdminExercise) => {
    setItems((previous) =>
      previous.map((item) => (item.id === exercise.id ? { ...item, is_active: !exercise.is_active } : item))
    );

    try {
      await updateRows<AdminExercise>(
        "exercises",
        {
          id: `eq.${exercise.id}`
        },
        {
          is_active: !exercise.is_active
        }
      );
    } catch (toggleError) {
      setItems((previous) =>
        previous.map((item) => (item.id === exercise.id ? { ...item, is_active: exercise.is_active } : item))
      );
      const message = toggleError instanceof Error ? toggleError.message : "Failed to update active state.";
      setError(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }

    try {
      await deleteRows("exercises", { id: `eq.${deleting.id}` });
      setItems((previous) => previous.filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete exercise.";
      setError(message);
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-[24px] font-bold uppercase text-[#e8e4dc]">Exercises</h1>
        <Link
          href="/admin/exercises/new"
          className="inline-flex h-11 items-center rounded-[4px] bg-[#c8922a] px-4 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-[#0d0d0d]"
        >
          + Add Exercise
        </Link>
      </div>

      <div className="rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search exercises..."
          className="h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] placeholder:text-[#4a4740] focus:border-2 focus:border-[#c8922a] focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categoryFilters.map((filter) => {
            const active = categoryFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategoryFilter(filter.value)}
                className={`${filterButtonClass} ${
                  active ? "border-[#c8922a] text-[#c8922a]" : "border-[#2e2e2e] text-[#4a4740]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}

          {activityFilters.map((filter) => {
            const active = activityFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActivityFilter(filter.value)}
                className={`${filterButtonClass} ${
                  active ? "border-[#c8922a] text-[#c8922a]" : "border-[#2e2e2e] text-[#4a4740]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {error ? <p className="mt-3 font-data text-[13px] text-[#b84040]">{error}</p> : null}

        {loading ? (
          <p className="mt-4 font-data text-[13px] text-[#8a8478]">Loading exercises...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-[#2e2e2e]">
                  <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Name
                  </th>
                  <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Muscle Groups
                  </th>
                  <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Equipment
                  </th>
                  <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Category
                  </th>
                  <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Active
                  </th>
                  <th className="py-2 text-right font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((exercise) => (
                  <tr key={exercise.id} className="border-b border-[#2e2e2e]">
                    <td className="py-3 pr-3 font-display text-[15px] font-semibold text-[#e8e4dc]">{exercise.name}</td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">
                      {compactList(exercise.primary_muscles ?? [], 3)}
                    </td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">
                      {compactList(exercise.equipment ?? [], 4)}
                    </td>
                    <td className="py-3 pr-3 font-data text-[12px] uppercase text-[#4a4740]">{exercise.category}</td>
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => {
                          void toggleActive(exercise);
                        }}
                        className={`inline-flex h-7 min-w-[48px] items-center justify-center rounded-[4px] border px-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] ${
                          exercise.is_active
                            ? "border-[#c8922a] text-[#c8922a]"
                            : "border-[#2e2e2e] text-[#4a4740]"
                        }`}
                      >
                        {exercise.is_active ? "ON" : "OFF"}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/exercises/${exercise.id}/edit`}
                          className="inline-flex h-7 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleting(exercise)}
                          className="inline-flex h-7 items-center rounded-[4px] border border-[#b84040] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b84040]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="py-5 text-center font-data text-[13px] text-[#4a4740]">No exercises match your filter.</p>
            ) : null}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="DELETE EXERCISE"
        body={`Permanently delete ${deleting?.name ?? "this exercise"}? This cannot be undone.`}
        confirmLabel="DELETE"
        cancelLabel="CANCEL"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}
