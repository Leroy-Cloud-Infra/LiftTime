"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ensureUsersProfile, getAuthenticatedUser, signOutAuth } from "@/components/admin/supabaseClient";
import { SessionOverview } from "@/screens/workout/SessionOverview";

export default function Page() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ready" | "redirecting">("checking");

  useEffect(() => {
    let active = true;

    const gate = async () => {
      try {
        const authUser = await getAuthenticatedUser();
        if (!authUser) {
          router.replace("/login");
          if (active) {
            setAuthState("redirecting");
          }
          return;
        }

        const profile = await ensureUsersProfile(authUser);
        if (profile.isDisabled) {
          await signOutAuth();
          router.replace("/login?reason=disabled");
          if (active) {
            setAuthState("redirecting");
          }
          return;
        }

        if (active) {
          setAuthState("ready");
        }
      } catch {
        await signOutAuth();
        router.replace("/login");
        if (active) {
          setAuthState("redirecting");
        }
      }
    };

    void gate();

    return () => {
      active = false;
    };
  }, [router]);

  if (authState !== "ready") {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0d0d0d] px-4 text-center">
        <p className="font-data text-[13px] text-[#8a8478]">Checking session...</p>
      </div>
    );
  }

  return <SessionOverview />;
}
