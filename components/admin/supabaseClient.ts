"use client";

import type { AdminAuthUser } from "@/types/admin";

const ACCESS_TOKEN_KEYS = ["sb-access-token", "supabase.auth.token"];

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface SupabaseAuthErrorResponse {
  error_description?: string;
  msg?: string;
  message?: string;
  error?: string;
}

interface PasswordSignInResponse {
  access_token?: string;
  refresh_token?: string | null;
  user?: {
    id?: string;
    email?: string | null;
  };
}

interface UserProfileBootstrapRow {
  id: string;
  email: string;
  is_disabled: boolean;
}

export interface AuthRedirectHashResult {
  hasSession: boolean;
  error: string | null;
}

export interface EnsureUserProfileResult {
  isDisabled: boolean;
}

const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
};

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractTokenFromParsed = (parsed: unknown): string | null => {
  if (!parsed) {
    return null;
  }

  if (typeof parsed === "string") {
    return parsed;
  }

  if (typeof parsed !== "object") {
    return null;
  }

  const object = parsed as Record<string, unknown>;

  if (typeof object.access_token === "string") {
    return object.access_token;
  }

  const currentSession = object.currentSession;
  if (currentSession && typeof currentSession === "object") {
    const sessionObj = currentSession as Record<string, unknown>;
    if (typeof sessionObj.access_token === "string") {
      return sessionObj.access_token;
    }
  }

  return null;
};

export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  for (const key of ACCESS_TOKEN_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    const token = extractTokenFromParsed(tryParseJson(raw)) ?? raw;
    if (token) {
      return token;
    }
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.includes("auth-token")) {
      continue;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    const token = extractTokenFromParsed(tryParseJson(raw));
    if (token) {
      return token;
    }
  }

  const cookieToken = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("sb-access-token="));

  if (!cookieToken) {
    return null;
  }

  return decodeURIComponent(cookieToken.split("=").slice(1).join("="));
};

const setStoredAccessToken = (accessToken: string, refreshToken?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("sb-access-token", accessToken);
  window.localStorage.setItem(
    "supabase.auth.token",
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken ?? null
    })
  );
};

const parseAuthErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as SupabaseAuthErrorResponse;
    return data.error_description || data.msg || data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const buildHeaders = (token?: string | null, includeJson = true): HeadersInit => {
  const { anonKey } = getSupabaseConfig();

  const headers: Record<string, string> = {
    apikey: anonKey
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  headers.Authorization = `Bearer ${token ?? anonKey}`;

  return headers;
};

const toQuery = (query: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    params.append(key, String(value));
  });

  return params.toString();
};

export const getAuthenticatedUser = async (): Promise<AdminAuthUser | null> => {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: buildHeaders(token, false),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { id: string; email?: string | null };
  if (!data.id) {
    return null;
  }

  return {
    id: data.id,
    email: data.email ?? ""
  };
};

export const signInWithEmailPassword = async (email: string, password: string): Promise<AdminAuthUser> => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) {
    throw new Error("EMAIL_AND_PASSWORD_REQUIRED");
  }

  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await parseAuthErrorMessage(response, "Unable to sign in with email and password.");
    throw new Error(message);
  }

  const data = (await response.json()) as PasswordSignInResponse;
  if (!data.access_token || !data.user?.id) {
    throw new Error("INVALID_AUTH_RESPONSE");
  }

  setStoredAccessToken(data.access_token, data.refresh_token ?? null);

  return {
    id: data.user.id,
    email: data.user.email ?? normalizedEmail
  };
};

export const getOAuthAuthorizeUrl = (provider: string, redirectTo: string): string => {
  const { url } = getSupabaseConfig();
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
    response_type: "token"
  });

  return `${url}/auth/v1/authorize?${params.toString()}`;
};

export const consumeAuthRedirectHash = (): AuthRedirectHashResult => {
  if (typeof window === "undefined") {
    return { hasSession: false, error: null };
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) {
    return { hasSession: false, error: null };
  }

  const params = new URLSearchParams(hash);
  const error = params.get("error_description") || params.get("error");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (error) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return { hasSession: false, error };
  }

  if (!accessToken) {
    return { hasSession: false, error: null };
  }

  setStoredAccessToken(accessToken, refreshToken);
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return { hasSession: true, error: null };
};

export const ensureUsersProfile = async (user: AdminAuthUser): Promise<EnsureUserProfileResult> => {
  const existingProfile = await fetchSingleRow<UserProfileBootstrapRow>("users_profile", {
    select: "id,email,is_disabled",
    id: `eq.${user.id}`
  });

  if (existingProfile) {
    return { isDisabled: existingProfile.is_disabled };
  }

  const normalizedEmail = user.email.trim();
  if (!normalizedEmail) {
    throw new Error("PROFILE_EMAIL_REQUIRED");
  }

  try {
    await insertRow<UserProfileBootstrapRow>("users_profile", {
      id: user.id,
      email: normalizedEmail
    });
  } catch {
    const racedProfile = await fetchSingleRow<UserProfileBootstrapRow>("users_profile", {
      select: "id,email,is_disabled",
      id: `eq.${user.id}`
    });

    if (!racedProfile) {
      throw new Error("PROFILE_BOOTSTRAP_FAILED");
    }

    return { isDisabled: racedProfile.is_disabled };
  }

  return { isDisabled: false };
};

export const signOutAuth = async (): Promise<void> => {
  const token = getAccessToken();
  const { url } = getSupabaseConfig();

  if (token) {
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: buildHeaders(token),
      cache: "no-store"
    }).catch(() => undefined);
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem("sb-access-token");
    window.localStorage.removeItem("supabase.auth.token");

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.includes("auth-token")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }
};

export const fetchRows = async <T>(
  table: string,
  query: Record<string, string | number | boolean | undefined>
): Promise<T[]> => {
  const token = getAccessToken();
  const { url } = getSupabaseConfig();
  const queryString = toQuery(query);

  const response = await fetch(`${url}/rest/v1/${table}?${queryString}`, {
    headers: {
      ...buildHeaders(token, false)
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${table}`);
  }

  return (await response.json()) as T[];
};

export const fetchSingleRow = async <T>(
  table: string,
  query: Record<string, string | number | boolean | undefined>
): Promise<T | null> => {
  const rows = await fetchRows<T>(table, {
    ...query,
    limit: 1
  });

  return rows[0] ?? null;
};

export const insertRow = async <T>(table: string, payload: Partial<T>): Promise<T> => {
  const token = getAccessToken();
  const { url } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...buildHeaders(token),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to insert ${table}`);
  }

  const rows = (await response.json()) as T[];
  if (!rows[0]) {
    throw new Error(`Insert returned empty result for ${table}`);
  }

  return rows[0];
};

export const updateRows = async <T>(
  table: string,
  filters: Record<string, string | number | boolean | undefined>,
  payload: Partial<T>
): Promise<void> => {
  const token = getAccessToken();
  const { url } = getSupabaseConfig();
  const queryString = toQuery(filters);

  const response = await fetch(`${url}/rest/v1/${table}?${queryString}`, {
    method: "PATCH",
    headers: {
      ...buildHeaders(token),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to update ${table}`);
  }
};

export const deleteRows = async (
  table: string,
  filters: Record<string, string | number | boolean | undefined>
): Promise<void> => {
  const token = getAccessToken();
  const { url } = getSupabaseConfig();
  const queryString = toQuery(filters);

  const response = await fetch(`${url}/rest/v1/${table}?${queryString}`, {
    method: "DELETE",
    headers: buildHeaders(token, false)
  });

  if (!response.ok) {
    throw new Error(`Failed to delete from ${table}`);
  }
};
