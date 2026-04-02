# Claude Brain

A persistent memory server and dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Stores architectural decisions, working-style observations, agent rules, and mission state across sessions — so Claude picks up where it left off.

- **Brain server** (Express, port 7777) — REST API backed by SQLite (`~/.claude/brain.db`). WAL mode, automatic backups every 2h with 3-generation rotation.
- **Dashboard** (React 19 + Vite) — browse, search, annotate, and manage brain entries. Neural map, missions, agent profiles, reminders, experiments, and metrics.

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
| POST | `/memory/confidence` | Update entry confidence (firm/tentative). |
| POST | `/memory/retag` | Change project tags on an entry. |
| POST | `/memory/auto` | Auto-categorize and add an entry. |
| GET | `/memory/metrics` | Brain health stats. |
| GET | `/memory/timeline` | Time-travel data. |
| GET | `/memory/stream` | SSE live updates. |
| GET | `/memory/log` | Activity log. |

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
| POST | `/sessions/:id/end` | End session with handoff. Body: `{handoff: {done, remaining, blocked}}`. |
| GET | `/sessions` | List sessions. `?project=`, `?limit=`. |
| GET | `/sessions/:id` | Single session. |
| GET | `/sessions/latest/handoff` | Most recent handoff for session continuity. |
| GET | `/memory/sessions` | Legacy: inferred sessions from entry metadata. |

### Missions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/missions` | Create a mission with tasks. |
| GET | `/missions` | List missions. `?status=`, `?project=`. |
| GET | `/missions/resume?project=id` | Resumable missions with pending tasks. |
| GET | `/missions/agents` | Agent execution stats. |
| GET | `/missions/:id` | Single mission with tasks. |
| PATCH | `/missions/:id` | Update mission. |
| DELETE | `/missions/:id` | Delete mission. |
| POST | `/missions/:id/tasks` | Add tasks to mission. |
| PATCH | `/missions/:id/tasks/:taskId` | Update task status/agent/output. |

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
| PATCH | `/experiments/:id` | Update/conclude. |
| DELETE | `/experiments/:id` | Delete. |
| POST | `/experiments/:id/observations` | Record observation with sentiment. |
| PATCH | `/experiments/:id/observations/:obsId` | Update observation. |
| DELETE | `/experiments/:id/observations/:obsId` | Delete observation. |

### Profiles and projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory/profiles` | List agent profiles. |
| POST | `/memory/profiles` | Create profile (name, sections, tags, model, role, systemPrompt, constraints). |
| PATCH | `/memory/profiles/:id` | Update profile. |
| DELETE | `/memory/profiles/:id` | Delete profile. |
| GET | `/memory/projects` | List projects. |
| POST | `/memory/projects` | Create/update project. |
| DELETE | `/memory/projects` | Delete project. |
| POST | `/memory/projects/close` | Close project, archive exclusive entries. |
| POST | `/memory/projects/reopen` | Reopen project, unarchive entries. |

## Integrating with Claude Code

Start the brain server, then open Claude Code in your project and paste one of the prompts below. Claude will read this README, understand the API, and add the right instructions to your project's `CLAUDE.md`.

### Quick setup (recommended)

```
Read the brain-app README at <path-to-claude-brain>/README.md. Set up brain
integration for this project by adding the necessary instructions to my CLAUDE.md.

My project ID is "<project-id>" and the brain server runs at http://localhost:7777.

The integration should cover:
- Session startup: read brain context, check resumable missions, register the session.
- Brain writes: when to write, format for single and batch writes, conflict checking.
- Agent injection: use compact context format when injecting brain into subagent prompts.
- Mission tracking: create missions for multi-step work, update task status as work progresses.
- Session wrap-up: end the session with a handoff summary.
```

### Full setup (with reminders, experiments, and profiles)

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
- Brain-driven orchestration: query brain before non-trivial tasks, auto-write decisions,
  post-task brain diffs, conflict detection before writes.
```

### Concepts Claude needs to understand

These are the key behaviors the CLAUDE.md instructions should produce. Claude will read the API reference above and wire them up.

- **Session lifecycle.** At session start: `POST /sessions/start`, `GET /memory/context?project=<id>`, `GET /missions/resume?project=<id>`. At session end: `POST /sessions/:id/end` with handoff.
- **Brain writes.** `POST /memory` for one entry, `POST /memory/batch` for multiple. Always include `sessionId` and `project`. Search before writing to avoid duplicates. Check for conflicts before adding architecture or decision entries.
- **Context injection.** `GET /memory/context?format=compact&project=<id>` returns a token-efficient markdown summary of the brain. Inject this into subagent prompts so they respect past decisions.
- **Missions.** `POST /missions` to plan multi-step work. `PATCH /missions/:id/tasks/:taskId` to track progress. Missions survive across sessions — the next session resumes where the last one left off.
- **Reminders.** `POST /reminders` to create, `PATCH /reminders/:id` to complete/snooze. Pending reminders auto-appear in `/memory/context` output.
- **Experiments.** `POST /experiments` to start, `POST /experiments/:id/observations` to record results. Conclude when the trend is clear, graduate to agent rules if positive.
- **Profiles.** `GET /memory/context?profile=p-<id>` returns persona + filtered brain in one call. Use for subagent injection.

## Tech stack

- **Server:** Express 5, plain JS (ESM), SQLite (better-sqlite3).
- **Client:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack React Query, shadcn/ui.
