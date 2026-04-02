"use client";

import Link from "next/link";

export interface AdminNavProps {
  pathname: string;
  mobile?: boolean;
}

const items = [
  { label: "EXERCISES", href: "/admin/exercises" },
  { label: "REQUESTS", href: "/admin/requests" },
  { label: "USERS", href: "/admin/users" },
  { label: "CHANGELOG", href: "/admin/changelog" }
] as const;

export const AdminNav = ({ pathname, mobile = false }: AdminNavProps) => {
  if (mobile) {
    return (
      <nav className="flex h-11 items-center gap-1 overflow-x-auto border-b border-[#2e2e2e] bg-[#141414] px-3">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex h-8 shrink-0 items-center rounded-[4px] border px-3 font-display text-[11px] font-semibold uppercase tracking-[0.08em] ${
                active
                  ? "border-[#c8922a] text-[#c8922a]"
                  : "border-[#2e2e2e] text-[#4a4740]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          className="ml-auto inline-flex h-8 shrink-0 items-center rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
        >
          BACK TO APP
        </Link>
      </nav>
    );
  }

  return (
    <aside className="hidden w-[200px] shrink-0 border-r-2 border-[#2e2e2e] bg-[#141414] md:flex md:flex-col">
      <nav className="mt-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-11 items-center px-4 font-display text-[13px] font-semibold uppercase tracking-[0.08em] ${
                active ? "text-[#c8922a]" : "text-[#4a4740]"
              }`}
            >
              {active ? <span className="absolute left-0 top-0 h-full w-[3px] bg-[#c8922a]" aria-hidden="true" /> : null}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center px-1 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
        >
          ← BACK TO APP
        </Link>
      </div>
    </aside>
  );
};
