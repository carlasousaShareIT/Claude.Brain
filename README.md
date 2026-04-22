# Claude Brain

A persistent memory server and dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Stores architectural decisions, working-style observations, agent rules, and mission state across sessions — so Claude picks up where it left off.

- **Brain server** (Express, port 7777) — REST API backed by SQLite (`~/.claude/brain.db`). WAL mode, automatic backups every 2h with 3-generation rotation.
- **Dashboard** (React 19 + Vite) — browse, search, annotate, and manage brain entries. Neural map, missions, sessions, agent profiles, reminders, experiments, observer, analytics, and metrics.

## Setup

```bash
git clone https://github.com/carlasousaShareIT/Claude.Brain.git
cd Claude.Brain
npm install
```

Requires Node.js 20+ (see `.nvmrc`).

## Running

```bash
npm run dev          # server + client with hot reload
npm run dev:server   # Express server only (port 7777)
npm run dev:client   # Vite dev server only (port 5173)
npm run build && npm start  # production build
```

## Brain data

Default database: `~/.claude/brain.db`. Override with `BRAIN_DB_FILE=/path/to/brain.db`.

Created automatically on first start. Existing `~/.claude/brain.json` files are auto-migrated to SQLite on first run (idempotent, original file preserved).

## API reference

### Compound startup

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/startup` | Single call: registers session, fetches previous handoff, reads brain context (compact), checks resumable missions, gets pending reminders, returns compliance state. Body: `{sessionId, label, project}`. Returns plain text markdown. |

### Memory (core CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/memory` | Write a single entry (section, action, value). |
| POST | `/memory/batch` | Write multiple entries in one transaction. Body: `{operations: [...]}`. |
| GET | `/memory` | Read the full brain. `?project=id` for scoped. |
| GET | `/memory/search?q=keyword` | Full-text search across all sections. |
| GET | `/memory/context` | Brain as markdown for LLM injection. Params: `?project=`, `?mission=`, `?profile=`, `?format=compact`. |
| POST | `/memory/check` | Conflict detection before writes. |
| POST | `/memory/diff` | Post-task diff — find entries not yet in brain. |
| POST | `/memory/health` | Brain health audit — checks for stale, unreferenced, or conflicting entries. |
| POST | `/memory/confidence` | Update entry confidence (firm/tentative). |
| POST | `/memory/retag` | Change project tags on an entry. |
| POST | `/memory/auto` | Auto-categorize and add an entry. |
| GET | `/memory/metrics` | Brain health stats. |
| GET | `/memory/timeline` | Time-travel data. |
| GET | `/memory/stream` | SSE live updates. |
| GET | `/memory/log` | Activity log. |
| DELETE | `/memory/log` | Clear activity log. |

### Context format

`GET /memory/context` returns markdown. Add `?format=compact` for a terser version suited to agent injection — same content, less formatting (no confidence tags, no icons, abbreviated headers, terse experiment summaries, only pending/in-progress mission tasks).

### Archive and annotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/memory/archive` | Archive an entry (soft-delete). |
| GET | `/memory/archived` | List archived entries. |
| POST | `/memory/unarchive` | Restore archived entry. |
| POST | `/memory/annotate` | Add annotation to an entry. |
| DELETE | `/memory/annotate` | Remove annotation. |
| GET | `/memory/annotations` | List annotated entries. |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/start` | Register session start. Body: `{id, label, project}`. |
| POST | `/sessions/:id/end` | End session with handoff. Body: `{handoff: {done, remaining, blocked, decisions}}`. |
| PATCH | `/sessions/:id` | Update session metadata (label, project). |
| PATCH | `/sessions/:id/handoff` | Update handoff data regardless of session state. |
| GET | `/sessions` | List sessions. `?project=`, `?limit=`. |
| GET | `/sessions/:id` | Single session. |
| GET | `/sessions/search?q=keyword` | Full-text search across handoff summaries, labels, projects. |
| GET | `/sessions/latest/handoff` | Most recent handoff for session continuity. `?project=` to scope. |
| GET | `/sessions/health` | Aggregate health across recent sessions. `?limit=`. |
| GET | `/sessions/:id/health` | Single session health detail (green/yellow/red). |
| GET | `/sessions/:id/compliance` | Compliance gate state (brain_query, agent_profile, reviewer). |
| POST | `/sessions/:id/activity` | Record session activity. Types: `brain_query`, `brain_write`, `profile_inject`, `reviewer_run`, `agent_spawn`, `commit`. |
| POST | `/sessions/:id/heartbeat` | Increment tool call counter, return health status. Body: `{toolName}`. |
| GET | `/memory/sessions` | Legacy: inferred sessions from entry metadata. |

### Session health

The heartbeat endpoint tracks `tool_call_count` and `task_completed_count` per session. Health thresholds:
- **Green:** < 40 tool calls and < 60min elapsed.
- **Yellow:** 40+ tool calls or 60+ minutes.
- **Red:** 70+ tool calls or 120+ minutes. Triggers perimortem warnings.

### Missions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/missions` | Create a mission with tasks. Accepts optional `template` field. |
| GET | `/missions` | List missions. `?status=`, `?project=`. |
| GET | `/missions/:id` | Single mission with tasks. |
| PATCH | `/missions/:id` | Update mission. |
| DELETE | `/missions/:id` | Delete mission. |
| GET | `/missions/resume?project=id` | Resumable missions with pending tasks. |
| GET | `/missions/agents` | Agent execution stats aggregated from task data. |
| GET | `/missions/:id/metrics` | Per-mission metrics. |
| GET | `/missions/:id/next` | Next pending task for a mission. |
| POST | `/missions/:id/tasks` | Add tasks to mission. |
| PATCH | `/missions/:id/tasks/:taskId` | Update task status/agent/output. |
| PATCH | `/missions/:id/tasks/:taskId/retry` | Retry a failed/blocked task. |
| POST | `/missions/:id/notes` | Add a note to a mission. |
| GET | `/missions/:id/notes` | List mission notes. |

#### Mission templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/missions/templates` | Create a reusable mission template. Body: `{name, description, tasks}`. |
| GET | `/missions/templates` | List templates. `?project=`. |
| GET | `/missions/templates/:id` | Single template. |
| PATCH | `/missions/templates/:id` | Update template. |
| DELETE | `/missions/templates/:id` | Delete template. |

### Reminders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reminders` | Create. Body: `{text, priority, dueDate, project}`. |
| GET | `/reminders` | List. `?status=`, `?project=`, `?due=overdue`. |
| PATCH | `/reminders/:id` | Update (complete, snooze, edit). |
| DELETE | `/reminders/:id` | Delete. |

### Experiments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/experiments` | Create experiment with hypothesis. |
| GET | `/experiments` | List. `?status=`, `?project=`. |
| GET | `/experiments/:id` | Single experiment with observations. |
| GET | `/experiments/:id/effectiveness` | Experiment effectiveness metrics. |
| PATCH | `/experiments/:id` | Update/conclude. |
| DELETE | `/experiments/:id` | Delete. |
| POST | `/experiments/:id/observations` | Record observation with sentiment. |
| PATCH | `/experiments/:id/observations/:obsId` | Update observation. |
| DELETE | `/experiments/:id/observations/:obsId` | Delete observation. |

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory/profiles` | List agent profiles. |
| GET | `/memory/profiles/resolve?agentType=X` | Resolve subagent type to a profile. Used by hooks for auto-injection. |
| POST | `/memory/profiles` | Create profile (name, sections, tags, model, role, systemPrompt, constraints, agentTypes). |
| PATCH | `/memory/profiles/:id` | Update profile. |
| DELETE | `/memory/profiles/:id` | Delete profile. |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory/projects` | List projects. |
| POST | `/memory/projects` | Create/update project. |
| DELETE | `/memory/projects` | Delete project. |
| POST | `/memory/projects/close` | Close project, archive exclusive entries. |
| POST | `/memory/projects/reopen` | Reopen project, unarchive entries. |

### Observer

Real-time agent monitoring. Watches Claude Code JSONL files for tool usage patterns, detects stuck or spiraling agents.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/observer/watch` | Start watching a session's JSONL. Body: `{sessionId, jsonlPath}`. |
| POST | `/observer/unwatch` | Stop watching. Body: `{sessionId}`. |
| POST | `/observer/agent-started` | Register agent start for tracking. |
| POST | `/observer/agent-stopped` | Register agent stop. |
| GET | `/observer/watchers` | List active watchers. |
| GET | `/observer/violations` | List violations. `?type=`, `?sessionId=`. |
| GET | `/observer/violations/stats` | Violation statistics. |
| DELETE | `/observer/violations` | Clear violations. `?sessionId=` to scope. |
| GET | `/observer/stuck` | Currently stuck agents. |
| GET | `/observer/metrics` | Agent metrics (tool calls, tokens, duration). |
| GET | `/observer/metrics/summary` | Aggregated metrics summary. |
| DELETE | `/observer/metrics` | Clear metrics. `?sessionId=` to scope. |
| GET | `/observer/config` | Observer configuration. |
| PATCH | `/observer/config` | Update observer configuration. |

### Audit

Brain health auditing — checks for stale entries, duplicates, and conflicts.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/audit/run` | Run a brain audit. |
| GET | `/audit/reports` | List audit reports. |
| GET | `/audit/reports/latest` | Latest audit report. |
| POST | `/audit/dismiss` | Dismiss an audit finding. |
| POST | `/audit/promote` | Promote an audit finding to an action. |
| POST | `/audit/merge` | Merge duplicate entries flagged by audit. |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/summary` | Dashboard analytics summary. |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/memory/webhooks` | Register a webhook for brain events. |
| GET | `/memory/webhooks` | List registered webhooks. |
| DELETE | `/memory/webhooks` | Remove a webhook. |

## Integrating with Claude Code

Start the brain server, then open Claude Code in your project and paste one of the prompts below. Claude will read this README, understand the API, and add the right instructions to your project's `CLAUDE.md`.

### Quick setup (recommended)

```
Read the brain-app README at <path-to-claude-brain>/README.md. Set up brain
integration for this project by adding the necessary instructions to my CLAUDE.md.

My project ID is "<project-id>" and the brain server runs at http://localhost:7777.

The integration should cover:
- Session startup: use POST /sessions/startup for compound startup (returns plain text markdown).
- Brain writes: when to write, format for single and batch writes, conflict checking.
- Agent injection: use compact context format when injecting brain into subagent prompts.
- Mission tracking: create missions for multi-step work, update task status as work progresses.
- Session wrap-up: end the session with a handoff summary.
```

### Full setup (with all features)

```
Read the brain-app README at <path-to-claude-brain>/README.md. Set up full brain
integration for this project by adding instructions to my CLAUDE.md.

My project ID is "<project-id>" and the brain server runs at http://localhost:7777.

Include everything from the quick setup, plus:
- Reminders: create/complete/snooze reminders from natural language, surface pending
  reminders at session start.
- Experiments: track process experiments, auto-record observations, suggest concluding
  when trends are clear, graduate successful experiments to agent rules.
- Agent profiles: use profiles to inject filtered context + persona into subagent prompts.
  Profile resolution: GET /memory/profiles/resolve?agentType=X.
- Brain-driven orchestration: query brain before non-trivial tasks, auto-write decisions,
  post-task brain diffs, conflict detection before writes.
- Session health: heartbeat tracking with green/yellow/red thresholds, perimortem warnings.
- Observer: real-time agent monitoring for stuck/spiral detection.
```

### Concepts Claude needs to understand

These are the key behaviors the CLAUDE.md instructions should produce. Claude will read the API reference above and wire them up.

- **Session lifecycle.** At session start: `POST /sessions/startup` (compound — registers session, fetches handoff, context, resumable missions, reminders, compliance in one call). At session end: `POST /sessions/:id/end` with handoff.
- **Session health.** `POST /sessions/:id/heartbeat` on each tool call increments the counter and returns green/yellow/red status. Yellow warns, red triggers perimortem (wrap up and start fresh).
- **Brain writes.** `POST /memory` for one entry, `POST /memory/batch` for multiple. Always include `sessionId` and `project`. Search before writing to avoid duplicates. Check for conflicts before adding architecture or decision entries.
- **Context injection.** `GET /memory/context?format=compact&project=<id>` returns a token-efficient markdown summary of the brain. Inject this into subagent prompts so they respect past decisions.
- **Missions.** `POST /missions` to plan multi-step work. `PATCH /missions/:id/tasks/:taskId` to track progress. Missions survive across sessions — the next session resumes where the last one left off.
- **Reminders.** `POST /reminders` to create, `PATCH /reminders/:id` to complete/snooze. Pending reminders auto-appear in `/memory/context` output.
- **Experiments.** `POST /experiments` to start, `POST /experiments/:id/observations` to record results. Conclude when the trend is clear, graduate to agent rules if positive.
- **Profiles.** `GET /memory/context?profile=p-<id>` returns persona + filtered brain in one call. `GET /memory/profiles/resolve?agentType=X` resolves subagent types to profiles for hook-based auto-injection.
- **Observer.** `POST /observer/watch` to monitor a session's JSONL for stuck/spiral patterns. `GET /observer/stuck` to check for currently stuck agents. Violations are stored and surfaceable in the dashboard.
- **Compliance.** `GET /sessions/:id/compliance` checks enforcement gates (brain_query, agent_profile, reviewer). Used by hooks to gate commits and PRs.

## Integrating with Codex

Codex reads repo instructions from `AGENTS.md`. To enable the brain in Codex, add a project-level `AGENTS.md` at the repo root, or extend the existing one, with the startup, context, mission, and handoff rules you want Codex to follow.

Codex should be instructed to:

- Create a new `sessionId` UUID at session start.
- Pick a short `sessionLabel` from the user request.
- Set `projectId` based on the repo being worked in.
- Call `POST /sessions/startup` before non-trivial work.
- Read and apply the startup response before acting.
- Use `/memory`, `/missions`, and `/sessions/:id/end` for durable cross-session state.
- Continue normally if the brain server is unavailable.

### Minimal `AGENTS.md` example for Codex

```md
# Codex Brain Integration

Codex should use the local brain server at session start and throughout the session for continuity, context, missions, and handoff.

## Brain server

- Base URL: `http://localhost:7777`.
- Default project: `general`.
- If the server is unavailable or times out, continue normally without blocking the user.

## Session variables

At the beginning of each session, set:

- `sessionId`: a new UUID.
- `sessionLabel`: a short label based on the user request.
- `projectId`: current brain project.

Project selection:
- use `brain-app` when working inside `brain-app/`.
- otherwise use `general` unless another known project is clearly a better match.

## Mandatory startup

Before non-trivial work, Codex must call `POST /sessions/startup`.

PowerShell pattern:

```powershell
$sessionId = [guid]::NewGuid().ToString()
$sessionLabel = "short task label"
$projectId = "general"

$body = @{
  sessionId = $sessionId
  label = $sessionLabel
  project = $projectId
} | ConvertTo-Json

$startup = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/sessions/startup" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Then read and apply `$startup.Content`.

The startup response is load-bearing. It contains:
- previous handoff.
- compact brain context.
- resumable missions.
- pending reminders.
- compliance state.

Do not just fetch it. Read it and identify the rules that apply before acting.

## Brain reads

Before non-trivial work, fetch compact project context:

```powershell
$context = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/memory/context?format=compact&project=$projectId"
```

Useful supporting reads:

```powershell
$handoff = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/sessions/latest/handoff?project=$projectId"

$missions = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/missions/resume?project=$projectId"
```

## Brain writes

Write durable cross-session information to the brain, not to local memory files.

```powershell
$body = @{
  section = "decisions"
  action = "add"
  value = "Decision text."
  project = $projectId
  sessionId = $sessionId
} | ConvertTo-Json

Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/memory" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Use `POST /memory/check` before writing architecture or decision entries. Use `POST /memory/batch` for multiple writes.

## Missions

For multi-step work, create and maintain a mission with `POST /missions`. Update task state with `PATCH /missions/<mission-id>/tasks/<task-id>` as work progresses.

## Subagents

If Codex uses subagents for non-trivial work, inject brain context into them first:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/memory/profiles/resolve?agentType=<agent-type>"
```

Then fetch the resolved profile context, or fall back to:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/memory/context?format=compact&project=$projectId"
```

## Wrap-up

At the end of the session, send a handoff:

```powershell
$body = @{
  handoff = @{
    done = @("Completed item.")
    remaining = @("Next item.")
    blocked = @()
    decisions = @("Decision made.")
  }
} | ConvertTo-Json -Depth 5

Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://localhost:7777/sessions/$sessionId/end" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```
```

### Codex notes

- `AGENTS.md` is the Codex equivalent of `CLAUDE.md`.
- Put the instructions at the repo root so Codex sees them immediately.
- Keep the startup call near the top of the instructions so Codex performs it before deeper work.
- If you already have an `AGENTS.md`, merge the brain section into it rather than creating a competing file.

## Dashboard

The dashboard at `http://localhost:5173` (dev) or `http://localhost:7777` (production) provides:

- **Neural map** — visual graph of brain entries and their relationships.
- **Missions** — mission list with task progress, agent timeline, notes, and metrics.
- **Sessions** — session history with health status, handoffs, activity timelines, and compliance.
- **Experiments** — experiment cards with observation tracking and sentiment analysis.
- **Reminders** — to-do list with priority, due dates, and snooze support.
- **Observer** — real-time agent monitoring with violation tracking and metrics.
- **Analytics** — summary dashboard with usage statistics.
- **Metrics** — brain health metrics and entry statistics.

## Tech stack

- **Server:** Express 5, plain JS (ESM), SQLite (better-sqlite3), schema versioned via `schema_meta` table with ALTER TABLE migrations.
- **Client:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack React Query, base-ui components.
- **Observer:** JSONL parser engine, spiral detector, stuck agent detection with configurable thresholds per agent role.
- **Enforcement hooks:** PreToolUse hooks for plan gating, reviewer gating, agent profile auto-injection, and session heartbeat.
