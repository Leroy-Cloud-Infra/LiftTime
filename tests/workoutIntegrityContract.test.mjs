import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const ts = require("typescript");

const principalId = "11000000-0000-4000-8000-000000000001";
const sessionId = "12000000-0000-4000-8000-000000000001";
const workoutExerciseId = "13000000-0000-4000-8000-000000000001";
const setId = "14000000-0000-4000-8000-000000000001";

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
  sid: "local-integrity-test"
})).toString("base64url");
const signature = createHmac("sha256", process.env.APP_SESSION_SECRET)
  .update(encodedPayload)
  .digest("base64url");
const cookie = `lt_session=${encodedPayload}.${signature}`;
const route = require("../.next/server/app/api/workout/mutate/route.js").routeModule.userland.POST;

const requestFor = (action, payload) => new NextRequest("http://localhost/api/workout/mutate", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ action, payload })
});

const completePayload = {
  workoutExerciseId,
  setId,
  setNumber: 1,
  setType: "working",
  weightLbs: 135,
  reps: 10,
  rir: 2
};

test("complete_set generates completed_at on the trusted server and returns it", async () => {
  const originalFetch = global.fetch;
  const patchBodies = [];
  const startedAt = Date.now();

  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/workout_exercises")) {
      return Response.json([{ id: workoutExerciseId, session_id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sessions")) {
      return Response.json([{ id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sets") && options.method === "GET") {
      return Response.json([{ id: setId, completed: false, completed_at: null }]);
    }
    if (url.pathname.endsWith("/workout_sets") && options.method === "PATCH") {
      const body = JSON.parse(options.body);
      patchBodies.push(body);
      return Response.json([{
        id: setId,
        workout_exercise_id: workoutExerciseId,
        set_number: 1,
        set_type: body.set_type,
        weight_lbs: body.weight_lbs,
        reps: body.reps,
        rir: body.rir,
        completed: body.completed,
        completed_at: body.completed_at,
        created_at: new Date(startedAt - 1000).toISOString()
      }]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await route(requestFor("complete_set", {
      ...completePayload,
      completedAt: "2000-01-01T00:00:00.000Z"
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(patchBodies.length, 1);
    assert.notEqual(patchBodies[0].completed_at, "2000-01-01T00:00:00.000Z");
    assert.ok(Date.parse(patchBodies[0].completed_at) >= startedAt);
    assert.equal(body.data.completedAt, patchBodies[0].completed_at);
  } finally {
    global.fetch = originalFetch;
  }
});

test("repeated complete_set preserves the original completed_at", async () => {
  const originalFetch = global.fetch;
  const originalCompletedAt = "2026-09-22T12:00:00.000Z";
  let patchCount = 0;

  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/workout_exercises")) {
      return Response.json([{ id: workoutExerciseId, session_id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sessions")) {
      return Response.json([{ id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sets") && options.method === "GET") {
      return Response.json([{ id: setId, completed: true, completed_at: originalCompletedAt }]);
    }
    if (options.method === "PATCH") {
      patchCount += 1;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await route(requestFor("complete_set", completePayload));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.completedAt, originalCompletedAt);
    assert.equal(patchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("update_set persists a completed set type without changing completion time or sibling values", async () => {
  const originalFetch = global.fetch;
  const originalCompletedAt = "2026-09-22T12:00:00.000Z";
  let patchBody;

  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/workout_exercises")) {
      return Response.json([{ id: workoutExerciseId, session_id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sessions")) {
      return Response.json([{ id: sessionId }]);
    }
    if (url.pathname.endsWith("/workout_sets") && options.method === "GET") {
      return Response.json([{ id: setId, completed: true, completed_at: originalCompletedAt }]);
    }
    if (url.pathname.endsWith("/workout_sets") && options.method === "PATCH") {
      patchBody = JSON.parse(options.body);
      return Response.json([{ id: setId }]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await route(requestFor("update_set", {
      workoutExerciseId,
      setId,
      weightLbs: 135,
      reps: 10,
      rir: 2,
      setType: "warmup"
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(patchBody, {
      weight_lbs: 135,
      reps: 10,
      rir: 2,
      set_type: "warmup"
    });
    assert.equal(Object.hasOwn(patchBody, "completed_at"), false);
    assert.equal(Object.hasOwn(patchBody, "completed"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("delete mutations call only their transactional RPCs and map integrity outcomes", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  let exerciseOutcome = "exercise_has_completed_sets";

  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const body = JSON.parse(options.body);
    calls.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/rpc/delete_workout_set_and_compact")) {
      return Response.json([{ outcome: "deleted" }]);
    }
    if (url.pathname.endsWith("/rpc/delete_workout_exercises_and_compact")) {
      return Response.json([{
        outcome: exerciseOutcome,
        deleted_workout_exercise_ids: exerciseOutcome === "deleted" ? [workoutExerciseId] : []
      }]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const setResponse = await route(requestFor("delete_set", { workoutExerciseId, setId }));
    assert.equal(setResponse.status, 200);
    assert.deepEqual(calls[0], {
      path: "/rest/v1/rpc/delete_workout_set_and_compact",
      body: { p_user_id: principalId, p_workout_exercise_id: workoutExerciseId, p_set_id: setId }
    });

    const rejectedResponse = await route(requestFor("delete_workout_exercises", {
      sessionId,
      workoutExerciseIds: [workoutExerciseId]
    }));
    assert.equal(rejectedResponse.status, 409);
    assert.deepEqual(await rejectedResponse.json(), { ok: false, error: "EXERCISE_HAS_COMPLETED_SETS" });

    exerciseOutcome = "deleted";
    const deletedResponse = await route(requestFor("delete_workout_exercises", {
      sessionId,
      workoutExerciseIds: [workoutExerciseId]
    }));
    assert.equal(deletedResponse.status, 200);
    assert.deepEqual((await deletedResponse.json()).data.deletedWorkoutExerciseIds, [workoutExerciseId]);
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test("browser complete helper omits completedAt and accepts the canonical server value", async () => {
  const source = readFileSync(new URL("../components/workout/workoutDataClient.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  let request;
  const canonicalCompletedAt = "2026-09-22T19:00:00.000Z";
  new Function("module", "exports", "fetch", compiled)(module, module.exports, async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return Response.json({ ok: true, data: { completedAt: canonicalCompletedAt } });
  });

  assert.deepEqual(await module.exports.completeSet(completePayload), { completedAt: canonicalCompletedAt });
  assert.equal(request.url, "/api/workout/mutate");
  assert.equal(Object.hasOwn(request.body.payload, "completedAt"), false);
});

test("completed set type changes commit before local canonical state changes", () => {
  const source = readFileSync(new URL("../screens/workout/ExerciseDetail.tsx", import.meta.url), "utf8");
  const handlerStart = source.indexOf("onChangeSetType={async (setType) => {");
  const commitIndex = source.indexOf("await onCommitSetEdit", handlerStart);
  const localUpdateIndex = source.indexOf("onUpdateSet(activeExercise.id, setRow.id, { setType });", handlerStart);
  assert.ok(handlerStart >= 0);
  assert.ok(commitIndex > handlerStart);
  assert.ok(localUpdateIndex > commitIndex);
});

test("integrity migration defines service-role-only transactional delete RPCs", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260922233000_gym_data_integrity_pass_1a.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /create or replace function public\.delete_workout_set_and_compact/);
  assert.match(sql, /create or replace function public\.delete_workout_exercises_and_compact/);
  assert.match(sql, /workout_set\.completed = true/);
  assert.match(sql, /set superset_group_id = null/);
  assert.match(sql, /grant execute on function public\.delete_workout_set_and_compact[^;]+to service_role/);
  assert.match(sql, /grant execute on function public\.delete_workout_exercises_and_compact[^;]+to service_role/);
});
