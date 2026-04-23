# Brain Server API Reference

REST API for the persistent memory layer serving Claude Code sessions.

**Base URL:** `http://192.168.50.3:7777` (over LAN) or `http://localhost:7777` (local).
**Content type:** JSON for all requests and responses unless noted.
**Total endpoints:** 106.

## Groups

| Group | Count | Mount |
|---|---|---|
| Memory | 16 | `/memory/*` (includes inline `/memory/merge`) |
| Archive | 3 | `/memory/archive*` |
| Projects | 5 | `/memory/projects*` |
| Profiles | 5 | `/memory/profiles*` |
| Metrics | 1 | `/memory/metrics` |
| Webhooks | 3 | `/memory/webhooks` |
| SSE | 1 | `/memory/stream` |
| Missions | 19 | `/missions/*` |
| Sessions | 14 | `/sessions/*` |
| Reminders | 4 | `/reminders/*` |
| Experiments | 9 | `/experiments/*` |
| Skills | 5 | `/skills/*` |
| Audit | 6 | `/audit/*` |
| Observer | 14 | `/observer/*` |
| Analytics | 1 | `/analytics/*` |

## Conventions

- Fields marked **required** return 400 when missing.
- Where a field accepts an enum, the accepted values are listed literally.
- Numeric IDs and UUID-style IDs are all strings in JSON.
- Server-sent broadcasts over `/memory/stream` fire on most mutating endpoints — they are noted per endpoint.

---

## Memory

Core CRUD on brain entries, search, context injection, conflict detection, and timeline.

### POST /memory
Record a single memory operation.

**Body:**
- `section` (string, required) — one of `workingStyle`, `architecture`, `agentRules`, `decisions`.
- `action` (string, required) — for entry sections: `add`, `remove`, `update`. For `decisions`: `add`, `resolve`, `update`.
- `value` (string or object, required) — entry text, or for decisions an object like `{decision, status, confidence}`. For `update`, pass `{old, new}` to change the text.
- `source` (string, optional) — origin label (e.g. `claude-session`).
- `sessionId` (string, optional) — tags the entry for session tracing; triggers `brain_write` activity record.
- `confidence` (string, optional) — `firm` or `tentative`.
- `project` (array of strings, optional) — project IDs to scope the entry.

**Response:** `{ok: true}`.
**Errors:** 400 if missing section/action/value or the section is unknown.
**Broadcasts:** the action name (e.g. `add`, `remove`).

### POST /memory/batch
Run multiple memory operations in a single SQLite transaction.

**Body:**
- `operations` (array of memory-op objects, required) — each element has the same shape as `POST /memory` body.

**Response:** `{ok, results: [{index, ok, section, action}...], errors: [{index, error}...]}`. `ok` is true only when `errors` is empty.
**Errors:** 400 if operations missing/empty; 500 if the transaction itself fails.
**Broadcasts:** one broadcast per successful operation, fired after the transaction commits.

### GET /memory
Return the full brain (all sections and decisions), optionally filtered to a project.

**Query:**
- `project` (string, optional) — project ID.

**Response:** `{workingStyle: [...], architecture: [...], agentRules: [...], decisions: [...]}`.

### GET /memory/search
Search entries and decisions by keyword.

**Query:**
- `q` (string, required) — search term; lowercased and trimmed server-side.
- `project` (string, optional) — scope to project ID.
- `sessionId` (string, optional) — when provided, records a `brain_query` activity on the session.

**Response:** `{query, count, results: [...]}`.
**Errors:** 400 when `q` is missing.

### GET /memory/sessions
List every session ID that has written to memory, with counts and time ranges.

**Response:** array of `{sessionId, count, firstAt, lastAt}`.

### GET /memory/log
Recent write log (newest first).

**Response:** array of log entries `{action, section, source, sessionId, value, ts}`.

### DELETE /memory/log
Clear the write log.

**Response:** `{ok: true}`.

### POST /memory/auto
Auto-detect the section for a value and add it.

**Body:**
- `value` (string, required) — free text; section is inferred via `detectSection`.
- `source` (string, optional).
- `sessionId` (string, optional).
- `project` (array, optional).

**Response:** `{ok: true, section}`.
**Errors:** 400 when `value` missing.

### POST /memory/confidence
Change the confidence level on an existing entry or decision.

**Body:**
- `section` (string, required) — one of `workingStyle`, `architecture`, `agentRules`, `decisions`.
- `text` (string, required) — exact entry text or decision text to match.
- `confidence` (string, required) — `firm` or `tentative`.

**Response:** `{ok: true}`.
**Errors:** 400 for missing fields, invalid confidence, or unknown section; 404 when entry not found.

### POST /memory/health
Scan brain entries for references to files that no longer exist under a given repo path.

**Body:**
- `repoPath` (string, required) — absolute path. The server rejects paths containing `..`, root-like paths, or strings shorter than 10 chars.

**Response:** health report object (sections with stale references).
**Errors:** 400 for missing or unsafe `repoPath`.

### GET /memory/context
Compact markdown suitable for injection into LLM context.

**Query:**
- `project` (string, optional) — project scope.
- `mission` (string, optional) — mission scope (auto-resolves project and appends mission tasks).
- `profile` (string, optional) — profile ID to filter entries through a saved profile.
- `format` (string, optional) — `compact` for terser output.
- `sessionId` (string, optional) — records `brain_query` activity when provided.

**Response:** `text/markdown` body.
**Errors:** 404 when the requested mission or profile does not exist; 400 on other resolution errors.

### GET /memory/timeline
Timeline data for time-travel views.

**Query:**
- `project` (string, optional).

**Response:** timeline events array.

### POST /memory/check
Check whether a proposed entry would conflict with existing brain content.

**Body:**
- `value` (string, required) — proposed entry text.
- `section` (string, optional) — when provided, restricts the conflict check to that section.

**Response:** `{conflicts: [...], matches: [...]}`.
**Errors:** 400 when `value` missing.

### POST /memory/diff
Given a set of learned entries from a finished task, return which ones are already present vs. missing.

**Body:**
- `entries` (array, required) — each element `{section, text}` at minimum.
- `project` (string or array, optional) — scope.

**Response:** `{matched: [...], missing: [...]}`.
**Errors:** 400 when `entries` missing or empty.

### POST /memory/retag
Change the project tags on an existing entry.

**Body:**
- `section` (string, required).
- `text` (string, required).
- One of:
  - `project` (array) — replace entire tag array.
  - `addProject` (string) — add one tag.
  - `removeProject` (string) — remove one tag.

**Response:** `{ok: true}`.
**Errors:** 400 when section/text missing, none of the three project operations provided, or section unknown; 404 when entry not found.
**Broadcasts:** `retag`.

### POST /memory/merge
Read-only merge preview: returns what the server state would look like merged with an incoming brain dump. Does not persist.

**Body:** a full brain object shape `{workingStyle, architecture, agentRules, decisions}`.
**Response:** merged view (same shape).
**Errors:** 400 on invalid body; 500 on unhandled errors.

---

## Archive

Archive and unarchive individual entries. Archived entries do not appear in normal reads.

### POST /memory/archive
Move an entry to the archive.

**Body:**
- `section` (string, required) — one of `workingStyle`, `architecture`, `agentRules`, `decisions`.
- `text` (string, required) — exact text of entry to archive.

**Response:** `{ok: true}`.
**Errors:** 400 for missing/unknown section; 404 when entry not found.
**Broadcasts:** `archive`.

### GET /memory/archived
List all archived entries.

**Response:** `{workingStyle: [...], architecture: [...], agentRules: [...], decisions: [...]}`.

### POST /memory/unarchive
Restore an archived entry to its original section.

**Body:**
- `text` (string, required).

**Response:** `{ok: true, section}`.
**Errors:** 400 when text missing; 404 when entry not in archive.
**Broadcasts:** `unarchive`.

---

## Projects

Project definitions (id, name, repos, status).

### GET /memory/projects
List project definitions.

**Response:** array of `{id, name, repos, status}`.

### POST /memory/projects
Create or update a project.

**Body:**
- `id` (string, required).
- `name` (string, required).
- `repos` (array, optional).
- `status` (string, optional) — defaults to `active`.

**Response:** `{ok: true}`.
**Errors:** 400 when id or name missing.
**Broadcasts:** `project` with action `upsert`.

### DELETE /memory/projects
Remove a project definition.

**Body:**
- `id` (string, required).

**Response:** `{ok: true}`.
**Errors:** 400 when id missing; 404 when project not found.
**Broadcasts:** `project` with action `delete`.

### POST /memory/projects/close
Close a project — archives entries exclusive to this project and retags entries shared with other projects.

**Body:**
- `id` (string, required).

**Response:** `{ok: true, archived, retagged}` (counts).
**Errors:** 400 when id missing; 404 when project not found.
**Broadcasts:** `project-closed`.

### POST /memory/projects/reopen
Reopen a closed project and unarchive its entries.

**Body:**
- `id` (string, required).

**Response:** `{ok: true, unarchived}` (count).
**Errors:** 400 when id missing; 404 when project not found.
**Broadcasts:** `project-reopened`.

---

## Profiles

Context profiles — pre-configured context bundles that can be resolved by subagent type.

### GET /memory/profiles/resolve
Resolve a subagent type name to a profile.

**Query:**
- `agentType` (string, optional) — subagent type label.

**Response:** profile object.
**Errors:** 404 when no matching profile.

### GET /memory/profiles
List all profiles.

**Response:** array of profile objects.

### POST /memory/profiles
Create a profile.

**Body:**
- `name` (string, required).
- Plus any other profile fields accepted by `createProfile`.

**Response:** 201 with the created profile object.
**Errors:** 400 when name missing.
**Broadcasts:** `profile-updated`.

### PATCH /memory/profiles/:id
Update a profile.

**Body:** partial profile fields.
**Response:** updated profile.
**Errors:** 404 when profile not found.
**Broadcasts:** `profile-updated`.

### DELETE /memory/profiles/:id
Delete a profile.

**Response:** `{ok: true}`.
**Errors:** 404 when profile not found.
**Broadcasts:** `profile-updated` with `deleted` payload.

---

## Metrics

### GET /memory/metrics
Brain health summary stats.

**Query:**
- `project` (string, optional).

**Response:** metrics object (entry counts by section, decisions by status, etc).

---

## Webhooks

Outbound webhook registration. URLs must be public http/https — private LAN and cloud metadata endpoints are blocked.

### POST /memory/webhooks
Register a webhook URL for a set of events.

**Body:**
- `url` (string, required) — must be http/https; private ranges and `169.254.169.254` are rejected.
- `events` (array of strings, required) — event names to subscribe to.

**Response:** `{ok: true}`.
**Errors:** 400 for missing fields, invalid URL, or blocked host; 409 when URL already registered.

### DELETE /memory/webhooks
Unregister a webhook.

**Body:**
- `url` (string, required).

**Response:** `{ok: true}`.
**Errors:** 400 when url missing; 404 when not found.

### GET /memory/webhooks
List registered webhooks.

**Response:** array of `{url, events, createdAt}`.

---

## SSE

### GET /memory/stream
Server-Sent Events stream of all brain broadcasts.

**Headers:** responds with `Content-Type: text/event-stream`; client disconnects are cleaned up automatically.
**Events:** every mutating endpoint's broadcast surfaces here (e.g. `add`, `remove`, `retag`, `mission-updated`, `task-updated`, `reminder-created`, `experiment-created`, `observation-added`, `agent-started`, `agent-stopped`, `session:start`, `session:end`, etc).

---

## Missions

Multi-step work tracking. Missions contain tasks; tasks have a dual-gate completion path.

### POST /missions
Create a mission.

**Body:**
- `name` (string, required — unless a template is used and the template supplies a name).
- `project` (string, optional).
- `sessionId` (string, optional).
- `experimentId` (string, optional) — links the mission to an experiment.
- `tasks` (array of task objects, optional) — each `{description, title?, phase?, verificationCommand?, blockedBy?}`.
- `template` (string, optional) — template ID; its tasks are prepended and its name/project inherited when missing.

**Response:** 201 with the created mission.
**Errors:** 400 when name missing; 404 when template not found.
**Broadcasts:** `mission-created`.

### GET /missions
List missions.

**Query:**
- `status` (string, optional) — `active`, `completed`, `abandoned`.
- `project` (string, optional).

**Response:** array of mission summaries.

### GET /missions/resume
Resumable missions for a project (active missions with pending or in-progress tasks).

**Query:**
- `project` (string, optional).

**Response:** `{missions: [...]}`.

### POST /missions/templates
Create a mission template.

**Body:**
- `name` (string, required).
- `description` (string, optional).
- `project` (string, optional).
- `tasks` (array, required — non-empty).

**Response:** 201 with the template.
**Errors:** 400 when name or tasks missing/empty.

### GET /missions/templates
List templates.

**Query:**
- `project` (string, optional).

**Response:** array of templates.

### GET /missions/templates/:id
Fetch a single template.

**Response:** template object.
**Errors:** 404 when not found.

### PATCH /missions/templates/:id
Update a template.

**Body:** partial template fields.
**Response:** updated template.
**Errors:** 404 when not found.

### DELETE /missions/templates/:id
Delete a template.

**Response:** `{ok: true}`.
**Errors:** 404 when not found.

### GET /missions/agents
Aggregate agent execution stats across all missions.

**Response:** agent stats object.

### GET /missions/:id
Single mission with full task details.

**Response:** mission object with `tasks` array.
**Errors:** 404 when not found.

### GET /missions/:id/metrics
Derived stats for a mission (duration, task counts, agent breakdown).

**Response:** metrics object.
**Errors:** 404 when mission not found.

### GET /missions/:id/next
Tasks that are ready to work on (no unresolved `blockedBy` dependencies).

**Response:** array of tasks.
**Errors:** 404 when mission not found.

### PATCH /missions/:id
Update mission fields.

**Body:**
- `name` (string, optional).
- `status` (string, optional) — `active`, `completed`, `abandoned`.
- `project` (string, optional).

**Response:** updated mission.
**Errors:** 400 on invalid status; 404 when mission not found.
**Broadcasts:** `mission-updated`.

### DELETE /missions/:id
Delete a mission and all of its tasks and notes.

**Response:** `{ok: true}`.
**Errors:** 404 when not found.
**Broadcasts:** `mission-updated` with `deleted: true`.

### POST /missions/:id/tasks
Append tasks to an existing mission.

**Body:**
- `tasks` (array, required — non-empty).

**Response:** 201 with the array of newly created tasks.
**Errors:** 400 when tasks missing/empty; 404 when mission not found.
**Broadcasts:** `task-updated`.

### PATCH /missions/:id/tasks/:taskId
Update a task. Enforces the dual-gate completion path.

**Body:**
- `status` (string, optional) — `pending`, `in_progress`, `reviewed`, `completed`, `blocked`, `interrupted`, `verification_failed`.
- `assignedAgent` (string, optional).
- `sessionId` (string, optional).
- `output` (string, optional) — summary of work done; required in spirit when completing.
- `blockers` (array of strings, optional).
- `blockedBy` (array of task IDs, optional).
- `description` (string, optional).
- `title` (string, optional).
- `phase` (string, optional).
- `verificationCommand` (string, optional).
- `verificationResult` (object, optional) — e.g. `{exitCode: 0, stdout, stderr}`.

**Completion gates:**
- When a task has a `verificationCommand`, completion without a `verificationResult` returns **422**.
- A direct `in_progress` to `completed` transition without either a prior `reviewed` state or a passing `verificationResult` returns **400** with `reviewRequired`.

**Response:** updated task object, with `unblockedTasks` listing any tasks now ready due to this task completing.
**Errors:** 400 on invalid status or `reviewRequired`; 422 on `verificationRequired`; 404 when mission or task not found.
**Broadcasts:** `task-updated` (and `mission-updated` when mission auto-completes).

### PATCH /missions/:id/tasks/:taskId/retry
Retry a `verification_failed` task (resets status to `in_progress` and clears `verificationResult`).

**Response:** updated task.
**Errors:** 400 when task is not `verification_failed`; 404 when mission/task not found; 500 on update failure.
**Broadcasts:** `task-updated`.

### POST /missions/:id/notes
Append a note to a mission.

**Body:**
- `text` (string, required).
- `sessionId` (string, optional).

**Response:** 201 with the note.
**Errors:** 400 when text missing; 404 when mission not found.

### GET /missions/:id/notes
List notes on a mission.

**Response:** array of notes.
**Errors:** 404 when mission not found.

---

## Sessions

Session lifecycle tracking and compound startup.

### POST /sessions/startup
Compound startup — registers the session, returns handoff, brain context, resumable missions, reminders, and compliance state in a single call.

**Body:**
- `sessionId` (string, required).
- `label` (string, optional).
- `project` (string, optional).

**Query (or body):**
- `format` (string, optional) — `json` to return a JSON object; default response is `text/plain` markdown.

**Response (text/plain):** markdown with sections `# Session started`, `## Handoff (from: ...)`, `## Previous session health`, `## Resumable missions`, `## Reminders (N pending)`, `## Compliance`, `## Brain context`.
**Response (json):** `{session, handoff, previousHealth, context, resumable: {missions}, reminders, compliance}`.
**Errors:** 400 when sessionId missing.
**Broadcasts:** `session:start`.

### POST /sessions/start
Record session start without the full compound payload.

**Body:**
- `id` (string, required).
- `label` (string, optional).
- `project` (string, optional).

**Response:** session object.
**Errors:** 400 when id missing.
**Broadcasts:** `session:start`.

### POST /sessions/:id/end
End a session, optionally supplying handoff data. If the session is already ended and handoff is provided, updates the handoff instead.

**Body:**
- `handoff` (object, optional) — shape `{done, remaining, blocked, decisions}`, each a string array.

**Response:** updated session.
**Errors:** 404 when session not found; 409 when session already ended and no handoff provided.
**Broadcasts:** `session:end` (or `session:handoff-updated` when updating a closed session).

### PATCH /sessions/:id/handoff
Update handoff data regardless of whether the session is open or closed.

**Body:**
- `handoff` (object, required) — `{done, remaining, blocked, decisions}`.

**Response:** updated session.
**Errors:** 400 when handoff missing; 404 when session not found.
**Broadcasts:** `session:handoff-updated`.

### GET /sessions
List sessions.

**Query:**
- `limit` (number, optional) — default 50.
- `project` (string, optional).

**Response:** array of session summaries.

### GET /sessions/search
Full-text search across session handoffs, labels, and projects.

**Query:**
- `q` (string, required).
- `project` (string, optional).

**Response:** array of matching sessions.
**Errors:** 400 when q missing.

### GET /sessions/latest/handoff
Most recent session handoff (optionally scoped to project).

**Query:**
- `project` (string, optional).

**Response:** `{id, label, project, ended_at, handoff: {...}}`.
**Errors:** 404 when no sessions with handoff exist.

### GET /sessions/health
Aggregate health across recent sessions.

**Query:**
- `limit` (number, optional) — default 20.

**Response:** health summary.

### GET /sessions/:id/health
Single session health detail.

**Response:** `{toolCalls, tasksCompleted, endedCleanly, ...}`.
**Errors:** 404 when session not found.

### GET /sessions/:id/compliance
Enforcement gate state for the session.

**Response:** `{checks: {brain_query_gate, agent_profile_gate, reviewer_gate}, ...}`.

### POST /sessions/:id/activity
Record a session activity event (used by hooks and tooling).

**Body:**
- `type` (string, required) — one of `brain_query`, `brain_write`, `profile_inject`, `reviewer_run`, `agent_spawn`, `commit`.
- `details` (string, optional).

**Response:** `{ok: true}`.
**Errors:** 400 when type missing or invalid.

### POST /sessions/:id/heartbeat
Increment the session's tool-call counter and return health status. Intended for per-tool-call hook pings.

**Body:**
- `toolName` (string, optional).

**Response:** health status object.
**Errors:** 404 when session not found.

### PATCH /sessions/:id
Update session metadata.

**Body:**
- `label` (string, optional).
- `project` (string, optional).

**Response:** updated session.
**Errors:** 404 when session not found.

### GET /sessions/:id
Fetch a single session.

**Response:** session object.
**Errors:** 404 when session not found.

---

## Reminders

Personal to-do list. Server auto-unsnoozes reminders whose `snoozedUntil` has passed.

### POST /reminders
Create a reminder.

**Body:**
- `text` (string, required).
- `dueDate` (string, optional) — ISO date.
- `priority` (string, optional) — `low`, `normal` (default), `high`.
- `project` (string or array, optional).

**Response:** 201 with the created reminder.
**Errors:** 400 when text missing or priority invalid.
**Broadcasts:** `reminder-created`.

### GET /reminders
List reminders with filters. Auto-unsnoozes first.

**Query:**
- `status` (string, optional) — `pending` (default), `done`, `snoozed`, `all`.
- `project` (string, optional).
- `due` (string, optional) — `overdue` to only show overdue items.

**Response:** array of reminders.

### PATCH /reminders/:id
Update a reminder.

**Body:**
- `text` (string, optional).
- `status` (string, optional) — `pending`, `done`, `snoozed`.
- `priority` (string, optional) — `low`, `normal`, `high`.
- `dueDate` (string, optional).
- `snoozedUntil` (string, optional) — ISO date.
- `project` (string or array, optional).

**Response:** updated reminder.
**Errors:** 400 on invalid status or priority; 404 when reminder not found.
**Broadcasts:** `reminder-updated`.

### DELETE /reminders/:id
Delete a reminder.

**Response:** `{ok: true}`.
**Errors:** 404 when reminder not found.
**Broadcasts:** `reminder-deleted`.

---

## Experiments

Track process experiments and their observations over time.

### POST /experiments
Create an experiment.

**Body:**
- `name` (string, required).
- `hypothesis` (string, required).
- `project` (string or array, optional).
- `sessionId` (string, optional).

**Response:** 201 with the created experiment.
**Errors:** 400 when name or hypothesis missing.
**Broadcasts:** `experiment-created`.

### GET /experiments
List experiments.

**Query:**
- `status` (string, optional) — `active`, `concluded`, `abandoned`.
- `project` (string, optional).

**Response:** array of experiment summaries.

### GET /experiments/:id
Single experiment with all observations.

**Response:** `{id, name, hypothesis, status, conclusion, observations: [...], createdAt}`.
**Errors:** 404 when not found.

### GET /experiments/:id/effectiveness
Before/after comparison of observation sentiment for an experiment.

**Response:** `{experimentId, hypothesis, conclusion, observations: {positive, negative, neutral}, effectiveness}`.
**Errors:** 404 when not found.

### PATCH /experiments/:id
Update an experiment.

**Body:**
- `name` (string, optional).
- `hypothesis` (string, optional).
- `status` (string, optional) — `active`, `concluded`, `abandoned`.
- `conclusion` (string or null, optional) — `positive`, `negative`, `mixed`.
- `project` (string or array, optional).

**Response:** updated experiment.
**Errors:** 400 on invalid status or conclusion; 404 when not found.
**Broadcasts:** `experiment-updated`.

### POST /experiments/:id/observations
Add an observation. Only allowed while experiment status is `active`.

**Body:**
- `text` (string, required).
- `sentiment` (string, optional) — `positive`, `negative`, `neutral` (default `neutral`).
- `sessionId` (string, optional).
- `source` (string, optional).

**Response:** 201 with the observation.
**Errors:** 400 when text missing, sentiment invalid, or experiment is not active; 404 when experiment not found.
**Broadcasts:** `observation-added`.

### PATCH /experiments/:id/observations/:obsId
Update an observation.

**Body:**
- `text` (string, optional).
- `sentiment` (string, optional) — `positive`, `negative`, `neutral`.

**Response:** updated observation.
**Errors:** 400 on invalid sentiment; 404 when experiment or observation not found.
**Broadcasts:** `observation-updated`.

### DELETE /experiments/:id/observations/:obsId
Delete an observation.

**Response:** `{ok: true}`.
**Errors:** 404 when experiment or observation not found.
**Broadcasts:** `observation-deleted`.

### DELETE /experiments/:id
Delete an experiment and all its observations.

**Response:** `{ok: true}`.
**Errors:** 404 when experiment not found.
**Broadcasts:** `experiment-deleted`.

---

## Skills

Skill definitions — named content bundles scoped by project and type.

### POST /skills
Create a skill.

**Body:**
- `name` (string, required).
- `content` (string, required).
- `type` (string, optional).
- `project` (string or array, optional).
- `tags` (array, optional).

**Response:** 201 with the skill.
**Errors:** 400 when name or content missing.
**Broadcasts:** `skill-created`.

### GET /skills
List skills.

**Query:**
- `project` (string, optional).
- `type` (string, optional).

**Response:** array of skills.

### GET /skills/:id
Single skill.

**Response:** skill object.
**Errors:** 404 when not found.

### PATCH /skills/:id
Update a skill.

**Body:**
- `name`, `type`, `content`, `project`, `tags` — all optional.

**Response:** updated skill.
**Errors:** 404 when not found.
**Broadcasts:** `skill-updated`.

### DELETE /skills/:id
Delete a skill.

**Response:** 204 No Content.
**Errors:** 404 when not found.
**Broadcasts:** `skill-deleted`.

---

## Audit

Brain health audits and finding resolution.

### GET /audit/reports
List audit reports (newest first).

**Query:**
- `limit` (number, optional) — default 10.

**Response:** array of report summaries.

### GET /audit/reports/latest
Latest audit report in full.

**Response:** report object with findings.
**Errors:** 404 when no reports exist.

### POST /audit/run
Trigger a manual audit run.

**Body:** none.
**Response:** the newly generated report.

### POST /audit/dismiss
Dismiss a finding inside a report.

**Body:**
- `reportId` (string, required).
- `findingId` (string, required).

**Response:** updated report.
**Errors:** 400 when fields missing; 404 when report not found.

### POST /audit/promote
Promote a decision to the architecture section.

**Body:**
- `decisionId` (string, required).

**Response:** `{ok: true, ...}`.
**Errors:** 400 when decisionId missing; 404 when decision not found.

### POST /audit/merge
Merge two duplicate entries — keep one, archive the other.

**Body:**
- `keepSection` (string, required).
- `keepText` (string, required).
- `archiveSection` (string, required).
- `archiveText` (string, required).

**Response:** `{ok: true, ...}`.
**Errors:** 400 when fields missing; 404 when either entry not found.

---

## Observer

Agent lifecycle observation, watcher registration, and violation tracking.

### POST /observer/agent-started
Record a subagent start. Accepts both custom and Claude Code hook payloads.

**Body (accepts either casing):**
- `sessionId` or `session_id` (string, required).
- `agentId` or `agent_id` (string, required).
- `agentType` or `agent_type` (string, optional).

**Response:** `{ok: true}`.
**Errors:** 400 when sessionId or agentId missing.
**Broadcasts:** `agent-started`.

### POST /observer/agent-stopped
Record a subagent stop; enriches an existing dir-watcher with the real agent label when possible.

**Body:**
- `sessionId` or `session_id` (string, required).
- `agentId` or `agent_id` (string, optional).
- `agentType` or `agent_type` (string, optional).
- `transcriptPath` or `agent_transcript_path` (string, optional).

**Response:** `{ok: true}`.
**Errors:** 400 when sessionId missing.
**Broadcasts:** `agent-stopped`.

### POST /observer/watch
Register a watcher on an agent's JSONL log.

**Body:**
- `sessionId` (string, required).
- `jsonlPath` (string, required).
- `agentName` (string, required).
- `missionId` (string, optional) — auto-resolved from in-progress task when omitted.
- `taskId` (string, optional) — auto-resolved.
- `profile` (string, optional).

**Response:** 201 with watcher details.
**Errors:** 400 for missing required fields; 409 when a conflicting watcher is already active.

### POST /observer/unwatch
Stop watching an agent.

**Body:**
- `sessionId` (string, required).
- `agentName` (string, required).

**Response:** watcher removal details.
**Errors:** 400 for missing fields; 404 when watcher not found.

### GET /observer/watchers
List all active watchers.

**Response:** array of watcher objects.

### GET /observer/violations
List violations with optional filters.

**Query:**
- `session` (string, optional).
- `agent` (string, optional).
- `mission` (string, optional).
- `type` (string, optional).
- `limit` (number, optional).

**Response:** array of violations.

### GET /observer/violations/stats
Aggregate violation rates grouped by agent and type.

**Response:** stats object.

### GET /observer/stuck
Currently-stuck agents (for orchestrator polling).

**Response:** `{count, agents: [...]}`.

### DELETE /observer/violations
Clear violations.

**Query:**
- `type` (string, optional).
- `before` (string, optional) — ISO date cutoff.

**Response:** `{deleted}`.

### GET /observer/metrics
List agent metrics with optional filters.

**Query:**
- `session` (string, optional).
- `agent` (string, optional).
- `mission` (string, optional).
- `limit` (number, optional).

**Response:** array of metrics.

### GET /observer/metrics/summary
Agent metrics with aggregated session context.

**Query:**
- `agent` (string, optional).

**Response:** summary object.

### DELETE /observer/metrics
Clear agent metrics.

**Query:**
- `session` (string, optional).
- `agent` (string, optional).
- `before` (string, optional).

**Response:** `{deleted}`.

### GET /observer/config
Observer configuration (calibration mode, thresholds).

**Response:** config object.

### PATCH /observer/config
Update observer configuration.

**Body:** partial config fields.
**Response:** updated config.

---

## Analytics

### GET /analytics/summary
Aggregate across compliance, violations, time-per-project, and experiments.

**Query:**
- `limit` (number, optional) — default 30.

**Response:** analytics summary object.
