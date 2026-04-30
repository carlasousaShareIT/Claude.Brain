# Session startup hook RFC

## Problem

Claude Code sessions are identified by a UUID that appears in three places: the `.jsonl` transcript filename, the `sessionId` field inside that file, and the directory created under `tool-results/`. CLAUDE.md startup step 1 currently requires Claude to *derive* this UUID by reading a tool-result path it has already seen in the conversation.

Two forbidden derivation paths have caused production incidents:

- **`ls -t ~/.claude/projects/.../*.jsonl | head -1`** — picks the most-recently-modified `.jsonl` across all open Claude Code tabs, not just the current one. Caught 2026-04-30: this command ran while a banner-editor tab was active, returned that tab's session UUID, and overwrote its brain registration and label file.
- **`~/.claude/current-session-id`** — a shared file written by `reviewer-gate.sh`; races with every concurrent tab.

Phase 1 fixed the derivation rule: read the UUID from a tool-result path dirname already seen in this conversation. This is race-free. Phase 2 does not replace that derivation — it adds an early-registration layer and a startup-response cache on top of it.

## Goal

The `SessionStart` hook receives `session_id` in its JSON stdin payload. The hook's stdin is invisible to Claude in conversation context — Claude still must derive its session_id via Phase 1 (tool-result-path dirname). What the hook provides instead:

**(a) Early server-side registration.** The session row exists at hook fire time, before Claude's first turn. This eliminates the verify-after-register race in CLAUDE.md step 4: currently POST and GET happen in the same turn under load, and a 409 from the Phase 3 guard is possible if another tab fired first. With the hook, the row is already created before Claude starts.

**(b) Cached startup response on disk.** Once Claude derives its session_id via Phase 1, it reads `~/.claude/sessions/<id>.startup-response` instead of re-POSTing `/sessions/startup`. The POST already happened at hook time; Claude reads the result.

**(c) No-op Bash trigger no longer needed.** Phase 1 requires a no-op command to generate a tool-result path when none exists yet. With early registration, Claude's first real tool call produces the path — the explicit warm-up step can be removed from CLAUDE.md.

The hook is an early-registration and caching layer. Phase 1 derivation remains required and unchanged.

## Architectural invariant

**Only the orchestrator session may register with the brain via `POST /sessions/startup`.** Subagents must never call `/sessions/startup`. This is a load-bearing rule, not a defensive nicety.

Why this matters:
- A brain session row corresponds to a user-facing Claude Code conversation. Each row carries a label, project, handoff, and activity log that the next session reads at startup. A subagent's lifecycle is bounded by its parent's turn — it has no continuity to hand off.
- If subagents created session rows, the brain would fill with short-lived rows that pollute project queries, fragment the activity log, and break the multi-tab race-detection logic in the Phase 3 overwrite guard.

How this is enforced (defense in depth):
1. **Claude Code event model.** `SessionStart` fires only for the orchestrator's session. Subagents have their own lifecycle events (`SubagentStart` / `SubagentStop`) which already exist in `~/.claude/settings.json:106-127` and target `/observer/agent-started` / `/agent-stopped` — separate endpoints that record agent activity without creating session rows. Source: `https://code.claude.com/docs/en/hooks`.
2. **Hook script guard (lines 70–83).** If `agent_type` is present in the SessionStart payload (which would indicate a session started with `--agent`, an edge case), the hook exits 0 immediately. No `.startup`, no `.startup-response`, no POST.
3. **Server-side overwrite guard (Phase 3, `startup.js:145-163`).** If a subagent somehow POSTs `/sessions/startup` for a session_id that already has activity, the guard returns 409.

What the orchestrator owns:
- `POST /sessions/startup` (this hook + CLAUDE.md fallback).
- `PATCH /sessions/:id` (label/project after determination).
- `POST /sessions/:id/end` (handoff at session wrap-up).

What subagents may do:
- `GET /memory/*` for context reads.
- `POST /memory` for brain writes (these get tagged with the orchestrator's `sessionId`, which subagents inherit via prompt injection — they don't create their own).
- Their lifecycle is recorded automatically by the existing observer hooks. No session-row creation.

## Hook event choice

**Recommendation: `SessionStart`.**

| Property | `SessionStart` | First `PreToolUse` |
|---|---|---|
| Fires | Once, before any turn | Before first tool call (may be turn 2+) |
| Can block execution | No (docs: "SessionStart hooks cannot block execution") | Yes (`permissionDecision: deny`) |
| Payload includes `session_id` | Yes | Yes |
| Timing | Earliest possible | After user turn 1 is already in flight |
| Risk | None — fire-and-forget write | Blocking risk if curl hangs; misses the registration window |

`SessionStart` fires before any user interaction, so the session row and `.startup-response` file exist before CLAUDE.md startup runs. It cannot block execution even if the hook hangs or errors. `PreToolUse` fires too late and introduces unnecessary blocking risk.

**Matcher:** empty string (`""`) catches all source values (`startup`, `resume`, `clear`, `compact`). The hook fires for all of them; the POST to `/sessions/startup` is filtered to `source == "startup"` only inside the script. See "Source filter" sub-section below.

Source: `https://code.claude.com/docs/en/hooks` — SessionStart section:
> "Matcher values: startup (new session), resume (--resume, --continue, or /resume), clear (/clear), compact (auto or manual compaction)"

**Subagent behavior (resolved).** `SessionStart` does not fire for subagents. The docs state it fires only when Claude Code starts or resumes a session, and subagents use `SubagentStart`/`SubagentStop` for their lifecycle events. However, the docs also note that `agent_type` may appear in the payload when a session is started with `--agent`. A defensive guard is included in the hook script below.

## Hook script — `~/.claude/claude-startup.sh`

```bash
#!/bin/bash
# SessionStart hook: early session registration + startup-response cache.
# Non-blocking: exits 0 on any failure. Never modifies tool execution.

INPUT=$(cat)

# Extract fields from hook payload
SESSION_ID=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('session_id', ''))
except:
    print('')
" 2>/dev/null | tr -d '[:space:]')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Defensive guard: if this hook fires inside an --agent session, skip.
# Docs say SessionStart does not fire for subagents; guard is cheap insurance.
AGENT_TYPE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('agent_type', ''))
except:
    print('')
" 2>/dev/null | tr -d '[:space:]')

if [ -n "$AGENT_TYPE" ]; then
  exit 0
fi

SOURCE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('source', 'startup'))
except:
    print('startup')
" 2>/dev/null | tr -d '[:space:]')

# Write session UUID to deterministic file — idempotent overwrite is safe
STARTUP_FILE="$HOME/.claude/sessions/${SESSION_ID}.startup"
echo "$SESSION_ID" > "$STARTUP_FILE" 2>/dev/null

AUTH_HEADER=$(~/.claude/brain-auth-header.sh 2>/dev/null)
RESPONSE_FILE="$HOME/.claude/sessions/${SESSION_ID}.startup-response"

# Source filter: only POST /sessions/startup on initial startup.
# resume, clear, and compact all skip the POST:
#   - clear/compact: session is active (tool_call_count >= 3, ended_at null) — Phase 3 guard
#     would 409 and overwrite a good .startup-response with the error body.
#   - resume: if session was properly ended, .startup-response was deleted by session-cleanup.sh
#     and CLAUDE.md falls through to a live POST anyway (no caching benefit). If session is
#     still active (--continue with ended_at null), guard would also 409. Either way, skipping
#     is strictly safer with no functionality regression.
if [ "$SOURCE" = "startup" ]; then
  curl -s -H "$AUTH_HEADER" --max-time 5 \
    -X POST "http://localhost:7777/sessions/startup?format=json" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$SESSION_ID\",\"label\":null,\"project\":null}" \
    > "$RESPONSE_FILE" 2>/dev/null || true
fi

exit 0
```

### Source filter (resolved)

The hook registers with an empty matcher so it fires for all `source` values. The POST to `/sessions/startup` is gated on `source == "startup"` only. For `resume`, `clear`, and `compact`:
- `.startup` is still written — the UUID has not changed, idempotent overwrite is harmless.
- The POST is skipped — avoids a 409 from the Phase 3 guard and avoids overwriting a valid `.startup-response` with an error body.

`resume` rationale: on a properly-ended session, `session-cleanup.sh` has already deleted `.startup-response`, so CLAUDE.md falls through to a live POST and gets a fresh handoff/context — no caching benefit lost. On `--continue` of an active session (`ended_at` is null), the Phase 3 guard would 409. Skipping in both cases is strictly safer with no functionality regression.

## Persistence

Two files are written per session:

| File | Content | Purpose |
|---|---|---|
| `~/.claude/sessions/<id>.startup` | Session UUID (one line) | Exists for potential future use; not read by CLAUDE.md (see fallback section) |
| `~/.claude/sessions/<id>.startup-response` | JSON body of `/sessions/startup` response | Read by CLAUDE.md to skip the POST on turn 1 |

The response is requested as `?format=json` so individual fields (handoff, context, missions, reminders) can be extracted without markdown parsing. Confirmed: `startup.js:234` — `const format = req.query.format || req.body.format`.

**`session-cleanup.sh` change required (not done in this RFC).**

Current cleanup handles `.label`, `current-session-id`, and `enforcement-override` (`~/.claude/session-cleanup.sh:6-19`):

```python
# session-cleanup.sh:6-19 (current)
data = json.load(sys.stdin)
session_id = data.get('session_id', '')
if session_id:
    label_file = os.path.expanduser(f'~/.claude/sessions/{session_id}.label')
    if os.path.isfile(label_file):
        os.remove(label_file)
# Clean up current-session-id
sid_file = os.path.expanduser('~/.claude/current-session-id')
if os.path.isfile(sid_file):
    os.remove(sid_file)
# Clean up enforcement override
override_file = os.path.expanduser('~/.claude/enforcement-override')
if os.path.isfile(override_file):
    os.remove(override_file)
```

Required change — replace the single `.label` block with a loop covering all three per-session suffixes:

```python
# Replace lines 8-11 with:
if session_id:
    for suffix in ('.label', '.startup', '.startup-response'):
        f = os.path.expanduser(f'~/.claude/sessions/{session_id}{suffix}')
        if os.path.isfile(f):
            os.remove(f)
```

The `current-session-id` and `enforcement-override` removals (lines 12-19) are unchanged.

## Label/project chicken-and-egg

The hook fires before the user's first message. Label and project are unknown at hook time.

**Recommendation: option (a) — post with `label=null, project=null`.**

Verified: `db-store.js:2402` — `INSERT INTO sessions (id, label, project) VALUES (?, ?, ?)` uses `label || null, project || null`. SQLite accepts null on both columns. `updateSession` (`db-store.js:2443-2449`) uses the same conditional-set pattern and is also null-safe. Null is fully tolerated.

Option (b) (`label="<unlabeled>", project="general"`) was considered but rejected: `general` is a real project used for cross-cutting work. A placeholder row tagged `general` pollutes project-scoped queries and the brain UI until CLAUDE.md PATCHes. Null produces no pollution — the row exists but is untagged.

**PATCH flow after option (a):**

Once CLAUDE.md startup step 2 determines label and project, it PATCHes:

```bash
curl -s -H "$AUTH_HEADER" -X PATCH http://localhost:7777/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"$LABEL\",\"project\":\"$PROJECT\"}"
```

Confirmed: `PATCH /sessions/:id` exists at `sessions.js:128-134`, accepts `{label, project}`, calls `updateSession`. Open Q1 is resolved.

**Phase 3 guard interaction.** The guard triggers at `tool_call_count >= 3 AND !ended_at`. At hook fire time `tool_call_count = 0` — the guard passes. The PATCH happens at approximately tool call 1-2 (CLAUDE.md startup), well before the guard threshold. No conflict.

## Error handling

All errors exit 0. The hook must never block tool execution.

| Failure mode | Behavior |
|---|---|
| Brain server down | `curl` fails silently (`|| true`). `.startup` file still written. `.startup-response` absent or empty. CLAUDE.md falls back to POST. |
| Malformed JSON from Claude Code | `python3` exception caught, `SESSION_ID` empty, early `exit 0`. |
| Non-2xx from `/sessions/startup` | `curl` writes error body to `.startup-response`. CLAUDE.md checks for valid JSON before consuming; falls back to POST on parse failure. |
| `~/.claude/sessions/` dir missing | `echo > file` fails silently. `.startup` not written. CLAUDE.md proceeds with Phase 1 derivation and POST as before. |
| `brain-auth-header.sh` absent | `AUTH_HEADER` empty string. Curl sends no auth header — unauthenticated call. In passive mode (`BRAIN_AUTH=0`) resolves as bootstrap user. In enforcing mode returns 401. Hook exits 0 either way. |
| `source` is `resume`, `clear`, or `compact` | POST skipped. `.startup` overwritten with same UUID. `.startup-response` unchanged. |

Existing hooks all exit 0 unconditionally and swallow curl output. Pattern from `~/.claude/post-commit-record.sh:69`:
```bash
subprocess.run(curl_args, capture_output=True, timeout=3)
```
No return-code check. The new hook follows this pattern via `|| true` on the curl call.

## Brain-down fallback in CLAUDE.md

The hook's session_id is invisible to Claude in conversation context — there is no mechanism for Claude to read the hook's stdin. The `.startup` file exists but Claude cannot know which `.startup` file is its own without already knowing its session_id. Phase 1 derivation is therefore always required first.

The flow becomes:

```
1. Derive session_id from tool-result path (Phase 1, race-free — unchanged).
2. Try to read ~/.claude/sessions/<session_id>.startup-response
   - If file exists and parses as valid JSON: use it directly, skip POST /sessions/startup.
   - If missing or invalid JSON: POST /sessions/startup as fallback (current Phase 1 behavior).
3. PATCH /sessions/<id> with label/project once determined (sessions.js:128).
```

The explicit no-op Bash trigger can be removed from the primary CLAUDE.md path: Claude's first real tool call produces a tool-result path, and the session row already exists (created by the hook), so no warm-up is needed to avoid a missing-row 404.

## Settings.json registration

Add a `SessionStart` block to `~/.claude/settings.json` alongside the existing `SessionEnd` block (currently at `settings.json:128-138`). Hook type is `"command"` — confirmed by all existing shell-script hooks in the file (e.g., `plan-check.sh` at line 30, `reviewer-gate.sh` at line 45). HTTP hooks use `"type": "http"` (e.g., `SubagentStart` at line 108).

```json
"SessionStart": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "bash C:/Users/carla/.claude/claude-startup.sh"
      }
    ]
  }
]
```

The empty `matcher` string catches all source values. Source filtering (skip POST for `clear`/`compact`) is handled inside the hook script, not via the matcher.

## CLAUDE.md changes preview

The actual edit is the next mission task. Summary of changes:

1. **Step 1 (derive session_id):** Remove the explicit no-op Bash trigger from the primary path. Keep Phase 1 tool-result-path derivation unchanged. Note that the hook ensures a row exists before Claude's first turn.
2. **Step 3 (startup POST):** Add: "Before POSTing, check `~/.claude/sessions/<session_id>.startup-response`. If it exists and parses as valid JSON, read it directly and skip the POST. If absent or invalid, POST as before."
3. **Step 4 (verify):** Unchanged — GET `/sessions/:id` and assert `started_at` is fresh. Whether the row came from the hook or from a CLAUDE.md POST, the assertion still confirms correctness.
4. **Add new PATCH step:** After determining label/project (step 2), PATCH `/sessions/<id>` with `{label, project}` instead of relying on the POST to set them. Only needed when `.startup-response` was used (hook did the POST with nulls); skip if CLAUDE.md did the POST itself (label/project already set).

## Rollout safety

### Reversibility
- The hook is one block in `~/.claude/settings.json`. Remove it and behavior reverts instantly — no data migration, no server-side state to roll back.
- All hook outputs (`~/.claude/sessions/<id>.startup`, `<id>.startup-response`) are local files scoped to the session. Deleting them has no effect on the brain server.

### Additive CLAUDE.md change
The proposed update is a try-cached-then-fallback structure:
```
derive session_id via tool-result path (Phase 1)
if ~/.claude/sessions/<session_id>.startup-response exists AND parses as JSON:
    use it; skip POST
else:
    POST /sessions/startup as today
```
The `else` branch is exactly today's behavior. The old path is a permanent backstop, not a deprecation step.

### No impact on in-flight sessions
Existing tabs at hook-deploy time have no `.startup-response` files. CLAUDE.md falls through to the `else` branch. Zero migration. Only new sessions opened after the hook is registered exercise the cached path.

### Hook never blocks tool execution
- Every error branch exits 0.
- `curl --max-time 5` so a hung brain server cannot stall session startup.
- Subagent guard (`agent_type` early exit) prevents subagent invocations from registering as sessions.
- Source filter (`source == "startup"` only) prevents 409-body cache corruption on `resume`, `clear`, and `compact`.

### Defense in depth
- Server-side: Phase 3 overwrite guard at `startup.js:145-163` returns 409 if `tool_call_count >= 3 AND !ended_at`. Even a misfiring hook cannot clobber an active session row.
- Client-side: source filter restricts the POST to `source == "startup"` only, so `resume`, `clear`, and `compact` never overwrite `.startup-response` with an error body.

### Manual smoke test (run before registering the hook)

Run before adding the `SessionStart` block to `settings.json`:

```bash
# Test 1: new session (source=startup) — both files should appear
SAMPLE='{"session_id":"test-uuid-1234","source":"startup","transcript_path":"/tmp/test.jsonl","cwd":"'"$PWD"'"}'
echo "$SAMPLE" | bash ~/.claude/claude-startup.sh
ls -la ~/.claude/sessions/test-uuid-1234*
cat ~/.claude/sessions/test-uuid-1234.startup
# expected: contains "test-uuid-1234"
cat ~/.claude/sessions/test-uuid-1234.startup-response | python3 -m json.tool
# expected: valid JSON with session, handoff, context, etc.
rm ~/.claude/sessions/test-uuid-1234.*

# Test 2: resume/clear/compact — .startup appears, .startup-response must NOT be written
# (all three non-startup sources are skipped by the source filter)
SAMPLE2='{"session_id":"test-uuid-1234","source":"resume","transcript_path":"/tmp/test.jsonl","cwd":"'"$PWD"'"}'
echo "$SAMPLE2" | bash ~/.claude/claude-startup.sh
ls ~/.claude/sessions/test-uuid-1234* 2>&1
# expected: only test-uuid-1234.startup present, no .startup-response
rm ~/.claude/sessions/test-uuid-1234.startup
# Note: no DELETE endpoint exists for /sessions/:id on the brain server.
# The test-uuid-1234 row stays in the brain DB. Manual cleanup if needed:
# sqlite3 ~/.claude/brain.json "DELETE FROM sessions WHERE id='test-uuid-1234'"
```

### Per-step verification checklist

- [ ] **Hook script written:** manual smoke test passes — `startup` source produces both files; `resume` source produces only `.startup`.
- [ ] **`settings.json` updated:** open a fresh tab, verify hook fires, `.startup` and `.startup-response` appear under `~/.claude/sessions/`, brain shows the new session row at `GET /sessions/<id>`, no errors in stderr.
- [ ] **`session-cleanup.sh` updated:** end the test tab, verify all three suffixes (`.label`, `.startup`, `.startup-response`) are deleted for that session_id.
- [ ] **CLAUDE.md updated:** open a fresh tab; CLAUDE.md reads `.startup-response` and skips the POST. Verify by checking the brain server log shows only one POST for that session_id (from the hook), not a duplicate from CLAUDE.md.
- [ ] **Multi-tab test:** open two fresh tabs simultaneously; each registers under its own session_id; neither overwrites the other's `.startup-response` or brain session row.
