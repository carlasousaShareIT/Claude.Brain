// Smoke test for the POST /sessions/startup overwrite guard.
// Run with: node server/scripts/test-startup-guard.js
// Requires the brain server to be running on localhost:7777.

import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = "http://localhost:7777";

function getAuthHeader() {
  try {
    const token = readFileSync(join(homedir(), ".claude", "brain-token"), "utf8").trim();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

const AUTH = getAuthHeader();

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...AUTH },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* plain text response */ }
  return { status: res.status, text, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function cleanup(id) {
  try {
    await req("POST", `/sessions/${id}/end`, { handoff: { done: [], remaining: [], blocked: [], decisions: [] } });
  } catch { /* idempotent */ }
}

const sessions = [];

async function runTests() {
  // ------------------------------------------------------------------
  // Case (a): fresh session_id — no existing row, should succeed (200)
  // ------------------------------------------------------------------
  {
    const id = randomUUID();
    sessions.push(id);
    const { status } = await req("POST", "/sessions/startup", { sessionId: id, label: "test-fresh", project: "test" });
    assert(status === 200, `case a: expected 200 for fresh session, got ${status}`);
    console.log("PASS: (a) fresh session_id returns 200");
  }

  // ------------------------------------------------------------------
  // Case (b): existing row, tool_call_count < 3 — second startup succeeds
  // ------------------------------------------------------------------
  {
    const id = randomUUID();
    sessions.push(id);
    const r1 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-b-first", project: "test" });
    assert(r1.status === 200, `case b: first startup expected 200, got ${r1.status}`);
    // tool_call_count is still 0 after startup (no heartbeats)
    const r2 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-b-second", project: "test" });
    assert(r2.status === 200, `case b: second startup (tool_call_count<3) expected 200, got ${r2.status}`);
    console.log("PASS: (b) second startup with tool_call_count < 3 returns 200");
  }

  // ------------------------------------------------------------------
  // Case (c): existing row, ended_at set — startup after end succeeds
  // ------------------------------------------------------------------
  {
    const id = randomUUID();
    sessions.push(id);
    const r1 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-c", project: "test" });
    assert(r1.status === 200, `case c: initial startup expected 200, got ${r1.status}`);
    // Bump to active threshold so the guard would fire if not ended
    for (let i = 0; i < 3; i++) {
      await req("POST", `/sessions/${id}/heartbeat`, { toolName: "Bash" });
    }
    // End the session
    const endRes = await req("POST", `/sessions/${id}/end`, { handoff: { done: ["test"], remaining: [], blocked: [], decisions: [] } });
    assert(endRes.status === 200, `case c: end session expected 200, got ${endRes.status}`);
    // Now startup again — ended_at is set so guard should not fire
    const r2 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-c-resumed", project: "test" });
    assert(r2.status === 200, `case c: startup after end expected 200, got ${r2.status}`);
    console.log("PASS: (c) startup with ended_at set returns 200");
  }

  // ------------------------------------------------------------------
  // Case (d): tool_call_count >= 3, ended_at IS NULL — REJECTED with 409
  // ------------------------------------------------------------------
  {
    const id = randomUUID();
    sessions.push(id);
    const r1 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-d-original", project: "test" });
    assert(r1.status === 200, `case d: initial startup expected 200, got ${r1.status}`);
    // Bump tool_call_count to 3
    for (let i = 0; i < 3; i++) {
      await req("POST", `/sessions/${id}/heartbeat`, { toolName: "Bash" });
    }
    // Attempt second startup without force — should be rejected
    const r2 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-d-intruder", project: "test" });
    assert(r2.status === 409, `case d: expected 409, got ${r2.status}`);
    assert(r2.json && r2.json.error === "registration_conflict", `case d: expected error="registration_conflict", got ${JSON.stringify(r2.json)}`);
    assert(r2.json.existing && r2.json.existing.label === "test-d-original", `case d: expected existing.label="test-d-original", got ${r2.json.existing?.label}`);
    console.log("PASS: (d) active session (tool_call_count>=3) rejected with 409 registration_conflict");
  }

  // ------------------------------------------------------------------
  // Case (e): tool_call_count >= 3, force:true — OVERRIDE succeeds
  // ------------------------------------------------------------------
  {
    const id = randomUUID();
    sessions.push(id);
    const r1 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-e-original", project: "test" });
    assert(r1.status === 200, `case e: initial startup expected 200, got ${r1.status}`);
    for (let i = 0; i < 3; i++) {
      await req("POST", `/sessions/${id}/heartbeat`, { toolName: "Bash" });
    }
    // Attempt second startup with force:true — should succeed and overwrite label
    const r2 = await req("POST", "/sessions/startup", { sessionId: id, label: "test-e-override", project: "test", force: true });
    assert(r2.status === 200, `case e: force override expected 200, got ${r2.status}`);
    // Verify the label was overwritten by checking the session via GET
    const getRes = await req("GET", `/sessions/${id}`, undefined);
    assert(getRes.status === 200, `case e: GET session expected 200, got ${getRes.status}`);
    assert(getRes.json && getRes.json.label === "test-e-override", `case e: expected label="test-e-override" after override, got ${getRes.json?.label}`);
    console.log("PASS: (e) force:true overrides active session, returns 200 and overwrites label");
  }

  console.log(`\nAll 5 cases passed.`);
}

async function main() {
  try {
    await runTests();
  } finally {
    for (const id of sessions) {
      await cleanup(id);
    }
  }
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`);
  process.exit(1);
});
