"use client";

import React, { useEffect, useMemo, useState } from "react";

import { fetchRows, getAuthenticatedUser, updateRows } from "@/components/admin/supabaseClient";
import type { AdminUser } from "@/types/admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const authUser = await getAuthenticatedUser();
      setSelfId(authUser?.id ?? null);

      const rows = await fetchRows<AdminUser>("users_profile", {
        select:
          "id,display_name,email,experience_level,training_goal,created_at,last_active_at,is_admin,is_disabled",
        order: "created_at.desc"
      });

      setUsers(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load users.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return users;
    }

    return users.filter((user) => {
      const display = user.display_name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      return display.includes(needle) || email.includes(needle);
    });
  }, [search, users]);

  const toggleDisabled = async (user: AdminUser) => {
    if (selfId && user.id === selfId && !user.is_disabled) {
      setError("You cannot disable your own admin account.");
      return;
    }

    setUsers((previous) =>
      previous.map((item) => (item.id === user.id ? { ...item, is_disabled: !user.is_disabled } : item))
    );

    try {
      await updateRows<AdminUser>(
        "users_profile",
        {
          id: `eq.${user.id}`
        },
        {
          is_disabled: !user.is_disabled
        }
      );
    } catch (toggleError) {
      setUsers((previous) =>
        previous.map((item) => (item.id === user.id ? { ...item, is_disabled: user.is_disabled } : item))
      );
      const message = toggleError instanceof Error ? toggleError.message : "Failed to update user status.";
      setError(message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
      <h1 className="font-display text-[24px] font-bold uppercase text-[#e8e4dc]">Users</h1>
      <p className="mt-1 font-data text-[12px] text-[#4a4740]">{users.length} total users</p>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search users by name or email..."
        className="mt-4 h-10 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] placeholder:text-[#4a4740] focus:border-2 focus:border-[#c8922a] focus:outline-none"
      />

      {error ? <p className="mt-3 font-data text-[13px] text-[#b84040]">{error}</p> : null}

      {loading ? (
        <p className="mt-4 font-data text-[13px] text-[#8a8478]">Loading users...</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[4px] border-2 border-[#2e2e2e] bg-[#141414] p-3">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-[#2e2e2e]">
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Display Name
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Email
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Experience
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Goal
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Joined
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Last Active
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Admin
                </th>
                <th className="py-2 text-left font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Status
                </th>
                <th className="py-2 text-right font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4a4740]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isSelf = Boolean(selfId && user.id === selfId);

                return (
                  <tr key={user.id} className="border-b border-[#2e2e2e]">
                    <td className="py-3 pr-3 font-display text-[14px] font-semibold text-[#e8e4dc]">
                      {user.display_name || "—"}
                    </td>
                    <td className="py-3 pr-3 font-data text-[13px] text-[#4a4740]">{user.email}</td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">{user.experience_level || "—"}</td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">{user.training_goal || "—"}</td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-3 font-data text-[12px] text-[#4a4740]">
                      {user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {user.is_admin ? (
                        <span className="inline-flex h-6 items-center rounded-[3px] border border-[#c8922a] px-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#c8922a]">
                          Admin
                        </span>
                      ) : (
                        <span className="font-data text-[12px] text-[#4a4740]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-data text-[12px]">
                      <span className={user.is_disabled ? "text-[#b84040]" : "text-[#4a9e6b]"}>
                        {user.is_disabled ? "DISABLED" : "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={isSelf && !user.is_disabled}
                        onClick={() => {
                          void toggleDisabled(user);
                        }}
                        className={`inline-flex h-7 items-center rounded-[4px] border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.08em] ${
                          user.is_disabled
                            ? "border-[#4a9e6b] text-[#4a9e6b]"
                            : "border-[#b84040] text-[#b84040]"
                        } disabled:cursor-not-allowed disabled:border-[#2e2e2e] disabled:text-[#4a4740]`}
                      >
                        {user.is_disabled ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 ? (
            <p className="py-5 text-center font-data text-[13px] text-[#4a4740]">No users match your search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
