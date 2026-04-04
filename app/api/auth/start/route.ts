import { NextRequest, NextResponse } from "next/server";

import { getAuthEnv } from "@/lib/server/auth/env";
import { buildAuthAttemptCookie, createAuthAttemptPayload, resolveSafeReturnTo, shouldUseSecureCookies } from "@/lib/server/auth/session";

export const runtime = "nodejs";

const AUTH_SCOPE = "openid profile email";

const buildAuthorizeUrl = (input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}): string => {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", AUTH_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  return url.toString();
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getAuthEnv();
    const returnTo = resolveSafeReturnTo(request.nextUrl.searchParams.get("returnTo"));

    const payload = createAuthAttemptPayload({
      returnTo,
      ttlSeconds: env.authAttemptTtlSeconds
    });

    const authAttemptCookie = buildAuthAttemptCookie({
      cookieName: env.authAttemptCookieName,
      payload,
      secret: env.appSessionSecret,
      secure: shouldUseSecureCookies(env.appBaseUrl, request.nextUrl.protocol),
      maxAgeSeconds: env.authAttemptTtlSeconds
    });

    const authUrl = buildAuthorizeUrl({
      authorizationEndpoint: env.authentikAuthorizationEndpoint,
      clientId: env.authentikClientId,
      redirectUri: env.authentikRedirectUri,
      state: payload.state,
      nonce: payload.nonce
    });

    const response = NextResponse.redirect(authUrl, { status: 302 });
    response.cookies.set(authAttemptCookie.name, authAttemptCookie.value, authAttemptCookie.options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[auth.start] failed", { reason: message });
    return NextResponse.json({ error: "AUTH_START_FAILED" }, { status: 500 });
  }
}

