import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const ts = require("typescript");

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

const principalId = "11000000-0000-4000-8000-000000000001";
const issuedAt = Math.floor(Date.now() / 1000);
const encodedPayload = Buffer.from(JSON.stringify({
  v: 1,
  sub: principalId,
  iat: issuedAt,
  exp: issuedAt + 3600,
  sid: "local-library-test"
})).toString("base64url");
const signature = createHmac("sha256", process.env.APP_SESSION_SECRET)
  .update(encodedPayload)
  .digest("base64url");
const cookie = `lt_session=${encodedPayload}.${signature}`;
const route = require("../.next/server/app/api/workout/templates/route.js").routeModule.userland.GET;

const requestFor = (authenticated = true) => new NextRequest("http://localhost/api/workout/templates", {
  headers: authenticated ? { Cookie: cookie } : {}
});

test("library rejects unauthenticated requests before reading Supabase", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("Unexpected fetch"); };
  try {
    const response = await route(requestFor(false));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  } finally {
    global.fetch = originalFetch;
  }
});

test("library returns active template IDs and canonical names in exercise order", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const pushId = "79000000-0000-4000-8000-000000000001";
  const upperId = "79000000-0000-4000-8000-000000000002";
  const firstId = "8a000000-0000-4000-8000-000000000001";
  const secondId = "8a000000-0000-4000-8000-000000000002";

  global.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    let rows;
    if (url.pathname.endsWith("/workout_templates")) {
      rows = [{ id: pushId, name: "Push Day" }, { id: upperId, name: "Upper Body" }];
    } else if (url.pathname.endsWith("/workout_template_exercises")) {
      rows = [
        { workout_template_id: upperId, exercise_id: secondId, order_index: 2 },
        { workout_template_id: upperId, exercise_id: firstId, order_index: 1 },
        { workout_template_id: pushId, exercise_id: firstId, order_index: 1 }
      ];
    } else {
      rows = [{ id: secondId, name: "Lat Pulldown" }, { id: firstId, name: "Incline Dumbbell Press" }];
    }
    return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const response = await route(requestFor());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [
      { id: pushId, name: "Push Day", exerciseNames: ["Incline Dumbbell Press"] },
      { id: upperId, name: "Upper Body", exerciseNames: ["Incline Dumbbell Press", "Lat Pulldown"] }
    ] });
    assert.equal(calls.length, 3);
    assert.equal(calls[0].searchParams.get("is_active"), "eq.true");
    assert.equal(calls[0].searchParams.get("order"), "name.asc,id.asc");
    assert.equal(calls[2].searchParams.get("is_active"), "eq.true");
  } finally {
    global.fetch = originalFetch;
  }
});

test("library returns an empty list when no active templates exist", async () => {
  const originalFetch = global.fetch;
  let count = 0;
  global.fetch = async () => {
    count += 1;
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await route(requestFor());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
    assert.equal(count, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("browser library helper calls only the trusted same-origin route", async () => {
  const source = readFileSync(new URL("../components/workout/workoutLibraryClient.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  let request;
  new Function("module", "exports", "fetch", compiled)(module, module.exports, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  });
  assert.deepEqual(await module.exports.fetchWorkoutLibrary(), { items: [] });
  assert.deepEqual(request, { url: "/api/workout/templates", options: { method: "GET", cache: "no-store" } });
});
