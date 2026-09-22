import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const ts = require("typescript");

const principalId = "11000000-0000-4000-8000-000000000001";
const templateId = "79000000-0000-4000-8000-000000000001";
const sessionId = "12000000-0000-4000-8000-000000000001";

Object.assign(process.env, {
  APP_SESSION_SECRET: "local-contract-test-secret-0123456789-abcdef",
  APP_SESSION_TTL_SECONDS: "3600",
  APP_SESSION_REFRESH_WINDOW_SECONDS: "1800",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  AUTHENTIK_ISSUER_URL: "https://id.example/",
  AUTHENTIK_AUTHORIZATION_ENDPOINT: "https://id.example/auth",
  AUTHENTIK_TOKEN_ENDPOINT: "https://id.example/token",
  AUTHENTIK_JWKS_URI: "https://id.example/jwks",
  AUTHENTIK_CLIENT_ID: "test",
  AUTHENTIK_CLIENT_SECRET: "test",
  AUTHENTIK_REDIRECT_URI: "http://localhost/api/auth/callback",
  APP_BASE_URL: "http://localhost",
  SUPABASE_SERVICE_ROLE_KEY: "local-test-key"
});

const issuedAt = Math.floor(Date.now() / 1000);
const encodedPayload = Buffer.from(JSON.stringify({
  v: 1,
  sub: principalId,
  iat: issuedAt,
  exp: issuedAt + 3600,
  sid: "local-test-session"
})).toString("base64url");
const signature = createHmac("sha256", process.env.APP_SESSION_SECRET)
  .update(encodedPayload)
  .digest("base64url");
const cookie = `lt_session=${encodedPayload}.${signature}`;

// The route test uses the production-compiled handler without starting a server.
const route = require("../.next/server/app/api/workout/mutate/route.js").routeModule.userland.POST;

const requestFor = (payload) => new NextRequest("http://localhost/api/workout/mutate", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "start_workout_session", payload })
});

test("trusted start validates template IDs and maps RPC outcomes", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  let rpcOutcome = "created";

  global.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify([{
      outcome: rpcOutcome,
      session_id: rpcOutcome === "created" || rpcOutcome === "already_active" ? sessionId : null
    }]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    for (const payload of [{}, { templateId: "not-a-uuid" }]) {
      const response = await route(requestFor(payload));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "INVALID_INPUT");
    }
    assert.equal(calls.length, 0);

    for (const [outcome, status, error] of [
      ["template_not_found", 404, "TEMPLATE_NOT_FOUND"],
      ["template_inactive", 409, "TEMPLATE_INACTIVE"],
      ["template_invalid", 409, "TEMPLATE_INVALID"]
    ]) {
      rpcOutcome = outcome;
      const response = await route(requestFor({ templateId }));
      assert.equal(response.status, status);
      assert.equal((await response.json()).error, error);
    }

    for (const outcome of ["created", "already_active"]) {
      rpcOutcome = outcome;
      const response = await route(requestFor({ templateId }));
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { outcome, sessionId });
    }

    for (const call of calls) {
      assert.match(call.url, /\/rpc\/start_workout_session_from_template$/);
      assert.deepEqual(call.body, { p_user_id: principalId, p_template_id: templateId });
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("browser start helper forwards template ID to the trusted route", async () => {
  const source = readFileSync(new URL("../components/workout/workoutDataClient.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  let request;
  const mockedFetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ ok: true, data: { outcome: "created", sessionId } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  new Function("module", "exports", "fetch", compiled)(module, module.exports, mockedFetch);

  assert.deepEqual(await module.exports.startWorkoutSession(templateId), { outcome: "created", sessionId });
  assert.deepEqual(request, {
    url: "/api/workout/mutate",
    body: { action: "start_workout_session", payload: { templateId } }
  });
});
