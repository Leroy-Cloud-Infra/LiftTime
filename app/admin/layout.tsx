"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin/AdminNav";
import { fetchSingleRow, getAuthenticatedUser, signOutAuth } from "@/components/admin/supabaseClient";
import type { AdminAuthUser } from "@/types/admin";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface AdminProfileCheck {
  is_admin: boolean;
  is_disabled?: boolean;
  email?: string | null;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminAuthUser | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const authUser = await getAuthenticatedUser();
        if (!authUser) {
          router.replace("/login");
          return;
        }

        const profile = await fetchSingleRow<AdminProfileCheck>("users_profile", {
          select: "is_admin,is_disabled,email",
          id: `eq.${authUser.id}`
        });

        if (!profile || profile.is_disabled) {
          await signOutAuth();
          router.replace("/login");
          return;
        }

        if (!profile.is_admin) {
          router.replace("/");
          return;
        }

        if (active) {
          setAdminUser({
            id: authUser.id,
            email: authUser.email || profile.email || ""
          });
        }
      } catch {
        router.replace("/login");
        return;
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0d0d0d] px-4 text-center font-data text-[13px] text-[#8a8478]">
        Checking admin access...
      </div>
    );
  }

  if (!adminUser) {
    return null;
  }

  return (
    <div className="h-dvh bg-[#0d0d0d] text-[#e8e4dc]">
      <header className="flex h-12 items-center justify-between border-b border-[#2e2e2e] bg-[#141414] px-3 md:px-4">
        <h1 className="font-display text-[16px] font-bold uppercase tracking-[0.08em] text-[#e8e4dc]">LiftTime Admin</h1>
        <div className="flex items-center gap-2">
          <span className="hidden font-data text-[12px] text-[#4a4740] sm:block">{adminUser.email}</span>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await signOutAuth();
                router.replace("/login");
              })();
            }}
            className="h-8 rounded-[4px] border border-[#2e2e2e] px-3 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a8478]"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="h-[calc(100dvh-48px)] overflow-hidden">
        <AdminNav pathname={pathname} mobile />

        <div className="flex h-[calc(100%-44px)] md:h-full">
          <AdminNav pathname={pathname} />
          <main className="w-full flex-1 overflow-y-auto bg-[#0d0d0d]">{children}</main>
        </div>
      </div>
    </div>
  );
}
