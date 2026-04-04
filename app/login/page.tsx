"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import {
  consumeAuthRedirectHash,
  ensureUsersProfile,
  getAuthenticatedUser,
  getOAuthAuthorizeUrl,
  signInWithEmailPassword,
  signOutAuth
} from "@/components/admin/supabaseClient";
import type { AdminAuthUser } from "@/types/admin";

const DISABLED_ACCOUNT_MESSAGE = "This account has been disabled. Contact support.";

const mapAuthErrorToMessage = (message: string): string => {
  if (message === "EMAIL_AND_PASSWORD_REQUIRED") {
    return "Enter both email and password.";
  }

  if (message === "Invalid login credentials") {
    return "Invalid email or password.";
  }

  if (message === "PROFILE_EMAIL_REQUIRED") {
    return "This account is missing an email claim. Contact support.";
  }

  if (message === "PROFILE_BOOTSTRAP_FAILED") {
    return "Could not prepare your profile. Try again.";
  }

  if (message === "INVALID_AUTH_RESPONSE") {
    return "Sign-in response was invalid. Please try again.";
  }

  return message || "Unable to sign in right now.";
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authentikProvider = process.env.NEXT_PUBLIC_AUTHENTIK_PROVIDER ?? "keycloak";

  const completeSignIn = async (authUser: AdminAuthUser): Promise<void> => {
    const profileResult = await ensureUsersProfile(authUser);
    if (profileResult.isDisabled) {
      await signOutAuth();
      setAuthError(DISABLED_ACCOUNT_MESSAGE);
      return;
    }

    router.replace("/");
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      const disabledReason =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reason") === "disabled";
      if (disabledReason) {
        setAuthError(DISABLED_ACCOUNT_MESSAGE);
      }

      try {
        const hashResult = consumeAuthRedirectHash();
        if (hashResult.error && active) {
          setAuthError(mapAuthErrorToMessage(hashResult.error));
        }

        const authUser = await getAuthenticatedUser();
        if (!authUser || !active) {
          return;
        }

        await completeSignIn(authUser);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to verify session.";
        setAuthError(mapAuthErrorToMessage(message));
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [router]);

  const titleText = useMemo(() => "LiftTime", []);

  const onSubmitEmailPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const authUser = await signInWithEmailPassword(email, password);
      await completeSignIn(authUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setAuthError(mapAuthErrorToMessage(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignInWithAuthentik = () => {
    setAuthError(null);
    const redirectTo = `${window.location.origin}/login`;
    window.location.assign(getOAuthAuthorizeUrl(authentikProvider, redirectTo));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-[#0d0d0d] px-3 py-6 text-[#e8e4dc]">
      <div className="mt-10">
        <h1 className="font-display text-[42px] font-bold uppercase tracking-[0.06em] text-[#e8e4dc]">{titleText}</h1>
        <p className="mt-2 font-data text-[13px] text-[#8a8478]">track the work.</p>
      </div>

      <section className="mt-8 rounded-[4px] border border-[#2e2e2e] bg-[#141414] p-3">
        <h2 className="mb-3 font-display text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a8478]">Sign In</h2>

        {authError ? <p className="mb-3 font-data text-[12px] text-[#b84040]">{authError}</p> : null}

        <form onSubmit={onSubmitEmailPassword} className="space-y-3">
          <label className="block">
            <span className="mb-1 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8478]">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] placeholder:text-[#4a4740] focus:border-2 focus:border-[#c8922a] focus:outline-none"
              placeholder="you@example.com"
              disabled={isSubmitting || isCheckingSession}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-display text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8478]">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] px-3 font-data text-[14px] text-[#e8e4dc] placeholder:text-[#4a4740] focus:border-2 focus:border-[#c8922a] focus:outline-none"
              placeholder="••••••••"
              disabled={isSubmitting || isCheckingSession}
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting || isCheckingSession}
            className="h-12 w-full rounded-[4px] border-2 border-[#8a6219] bg-[#c8922a] font-display text-[16px] font-bold uppercase tracking-[0.08em] text-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing In..." : "Log In"}
          </button>
        </form>

        <div className="my-3 h-[2px] w-full bg-[#2e2e2e]" />

        <button
          type="button"
          onClick={onSignInWithAuthentik}
          disabled={isSubmitting || isCheckingSession}
          className="h-11 w-full rounded-[4px] border border-[#2e2e2e] bg-[#1c1c1c] font-display text-[14px] font-medium uppercase tracking-[0.08em] text-[#8a8478] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Sign In With Authentik
        </button>
      </section>
    </main>
  );
}
