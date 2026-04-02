"use client";

import React, { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { deleteRows, fetchRows, insertRow, updateRows } from "@/components/admin/supabaseClient";
import type { ChangelogEntry } from "@/types/admin";

interface ChangelogFormState {
  version: string;
  releaseDate: string;
  isPublished: boolean;
  changes: string[];
}

const createInitialFormState = (): ChangelogFormState => ({
  version: "",
  releaseDate: new Date().toISOString().slice(0, 10),
  isPublished: false,
  changes: [""]
});

const parseDate = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ChangelogFormState>(createInitialFormState());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ChangelogEntry | null>(null);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchRows<ChangelogEntry>("changelog", {
        select: "*",
        order: "release_date.desc"
      });

      rows.sort((a, b) => parseDate(b.release_date) - parseDate(a.release_date));
      setEntries(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load changelog.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const isEditing = useMemo(() => editingId !== null, [editingId]);

  const beginCreate = () => {
    setEditingId(null);
    setFormState(createInitialFormState());
    setError(null);
  };

  const beginEdit = (entry: ChangelogEntry) => {
    setEditingId(entry.id);
    setFormState({
      version: entry.version,
      releaseDate: entry.release_date,
      isPublished: entry.is_published,
      changes: entry.changes.length > 0 ? entry.changes : [""]
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormState(createInitialFormState());
    setError(null);
  };

  const updateChangeAt = (index: number, value: string) => {
    setFormState((previous) => {
      const next = [...previous.changes];
      next[index] = value;
      return { ...previous, changes: next };
    });
  };

  const removeChangeAt = (index: number) => {
    setFormState((previous) => {
      if (previous.changes.length === 1) {
        return previous;
      }
      return {
        ...previous,
        changes: previous.changes.filter((_, currentIndex) => currentIndex !== index)
      };
    });
  };

  const saveVersion = async () => {
    const cleanedChanges = formState.changes.map((item) => item.trim()).filter((item) => item.length > 0);

    if (!formState.version.trim()) {
      setError("Version number is required.");
      return;
    }

    if (!formState.releaseDate.trim()) {
      setError("Release date is required.");
      return;
    }

    if (cleanedChanges.length === 0) {
      setError("At least one change is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Partial<ChangelogEntry> = {
      version: formState.version.trim(),
      release_date: formState.releaseDate,
      is_published: formState.isPublished,
      changes: cleanedChanges
    };

    try {
      if (editingId) {
        await updateRows<ChangelogEntry>("changelog", { id: `eq.${editingId}` }, payload);
      } else {
        await insertRow<ChangelogEntry>("changelog", payload);
      }

      await loadEntries();
      cancelEdit();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save changelog entry.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (entry: ChangelogEntry) => {
    try {
      await updateRows<ChangelogEntry>(
        "changelog",
        {
          id: `eq.${entry.id}`
        },
        {
          is_published: !entry.is_published
        }
      );

      setEntries((previous) =>
        previous.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                is_published: !entry.is_published
              }
            : item
        )
      );
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Failed to update publish state.";
      setError(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }

    try {
      await deleteRows("changelog", { id: `eq.${deleting.id}` });
      setEntries((previous) => previous.filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete version.";
      setError(message);
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-[24px] font-bold uppercase text-[#e8e4dc]">Changelog</h1>
        <button
          type="button"
          onClick={beginCreate}
          className="inline-flex h-11 items-center rounded-[4px] bg-[#c8922a] px-4 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-[#0d0d0d]"
        >
          + Add Version
        </button>
      </div>

      <section className="mb-5 rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-4">
        <h2 className="font-display text-[16px] font-semibold uppercase text-[#e8e4dc]">
          {isEditing ? "Edit Version" : "Add Version"}
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
              Version Number *
            </label>
            <input
              value={formState.version}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  version: event.target.value
                }))
              }
              placeholder="1.2.0"
              className="h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
              Release Date *
            </label>
            <input
              type="date"
              value={formState.releaseDate}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  releaseDate: event.target.value
                }))
              }
              className="h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
            />
          </div>

          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]">
              <input
                type="checkbox"
                checked={formState.isPublished}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    isPublished: event.target.checked
                  }))
                }
                className="h-4 w-4 accent-[#c8922a]"
              />
              Is Published
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#4a4740]">
            Changes *
          </label>

          <div className="space-y-2">
            {formState.changes.map((change, index) => (
              <div key={`change-${index}`} className="flex gap-2">
                <input
                  value={change}
                  onChange={(event) => updateChangeAt(index, event.target.value)}
                  className="h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] focus:border-2 focus:border-[#c8922a] focus:outline-none"
                  placeholder="Describe one change"
                />
                <button
                  type="button"
                  onClick={() => removeChangeAt(index)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[4px] border border-[#2e2e2e] font-display text-[16px] text-[#8a8478]"
                  aria-label={`Remove change ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setFormState((previous) => ({
                ...previous,
                changes: [...previous.changes, ""]
              }))
            }
            className="mt-2 inline-flex h-9 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
          >
            + Add Change
          </button>
        </div>

        {error ? <p className="mt-3 font-data text-[13px] text-[#b84040]">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            className="h-10 rounded-[4px] border border-[#2e2e2e] px-4 font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void saveVersion();
            }}
            disabled={saving}
            className="h-11 rounded-[4px] bg-[#c8922a] px-4 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-[#0d0d0d] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Version"}
          </button>
        </div>
      </section>

      {loading ? (
        <p className="font-data text-[13px] text-[#8a8478]">Loading changelog...</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-[18px] font-bold text-[#e8e4dc]">v{entry.version}</h3>
                  <p className="mt-1 font-data text-[13px] text-[#4a4740]">
                    {new Date(entry.release_date).toLocaleDateString()} · {entry.changes.length} changes
                  </p>
                </div>
                <span
                  className={`inline-flex h-6 items-center rounded-[3px] border px-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] ${
                    entry.is_published ? "border-[#4a9e6b] text-[#4a9e6b]" : "border-[#2e2e2e] text-[#4a4740]"
                  }`}
                >
                  {entry.is_published ? "Published" : "Draft"}
                </span>
              </div>

              <ul className="mt-3 list-disc space-y-1 pl-4 font-data text-[13px] text-[#8a8478]">
                {entry.changes.map((change) => (
                  <li key={`${entry.id}-${change}`}>{change}</li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => beginEdit(entry)}
                  className="inline-flex h-8 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(entry)}
                  className="inline-flex h-8 items-center rounded-[4px] border border-[#b84040] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b84040]"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void togglePublish(entry);
                  }}
                  className="inline-flex h-8 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
                >
                  {entry.is_published ? "Unpublish" : "Publish"}
                </button>
              </div>
            </article>
          ))}

          {entries.length === 0 ? (
            <p className="py-5 text-center font-data text-[13px] text-[#4a4740]">No changelog versions yet.</p>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="DELETE VERSION"
        body={`Delete v${deleting?.version ?? ""}? This cannot be undone.`}
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
