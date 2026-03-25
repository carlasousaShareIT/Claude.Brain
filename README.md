# Claude Brain

A persistent memory server and dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Stores architectural decisions, working-style observations, agent rules, and mission state across sessions — so Claude picks up where it left off.

## What it does

- **Brain server** (Express, port 7777) — REST API that Claude Code reads/writes during sessions. Stores entries in a local `brain.json` file with sections for `workingStyle`, `architecture`, `agentRules`, `decisions`, plus project scoping and mission tracking.
- **Dashboard** (React 19 + Vite) — visual UI to browse, search, annotate, and manage brain entries. Includes a neural map visualization, mission tracker, metrics view, and a command palette for quick operations.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm

## Setup

```bash
git clone https://github.com/carlasousaShareIT/Claude.Brain.git
cd Claude.Brain
npm install
```

## Running

### Development (server + client with hot reload)

```bash
npm run dev
```

This starts both the Express server on `http://localhost:7777` and the Vite dev server on `http://localhost:5173`. The Vite dev server proxies `/memory` and `/missions` requests to the Express server.

### Production

```bash
npm run build
npm start
```

Builds the React app into `dist/`, then serves everything from the Express server at `http://localhost:7777`.

### Individual processes

```bash
npm run dev:server   # Express server only
npm run dev:client   # Vite dev server only
```

## Brain data

The server stores all data in a `brain.json` file. By default it uses `~/.claude/brain.json` — the standard Claude Code config directory.

To use a custom location, set the `BRAIN_FILE` environment variable:

```bash
BRAIN_FILE=/path/to/my/brain.json npm run dev
```

If the file (or its parent directory) doesn't exist, the server creates it with an empty structure on first run.

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory` | Read the full brain |
| POST | `/memory` | Write an entry (section, action, value) |
| GET | `/memory/search?q=keyword` | Search entries |
| GET | `/memory/context?project=id` | Brain as markdown for LLM context |
| POST | `/memory/check` | Conflict detection before writes |
| POST | `/memory/diff` | Post-task brain diff |
| GET | `/memory/stream` | SSE live updates |
| GET | `/memory/metrics` | Brain health stats |
| GET | `/memory/timeline` | Time-travel data |
| POST | `/memory/archive` | Archive an entry |
| GET | `/memory/archived` | List archived entries |
| POST | `/memory/annotate` | Add annotation to an entry |
| GET | `/memory/projects` | List projects |
| POST | `/memory/projects` | Add/update a project |
| POST | `/missions` | Create a mission |
| GET | `/missions` | List missions (?status=, ?project=) |
| GET | `/missions/resume` | Get resumable work for a project |
| PATCH | `/missions/:id` | Update a mission |
| PATCH | `/missions/:id/tasks/:taskId` | Update a mission task |

## Integrating with Claude Code

The brain server is designed to be called from your `CLAUDE.md` project instructions. Add the following sections to teach Claude how to read/write brain state across sessions.

### 1. Session startup

Add this to your `CLAUDE.md` so Claude loads brain context at the start of every conversation:

```markdown
## Session startup (do this FIRST, before responding to the user)
1. **Determine active project** — from the user's first message or the repo being worked on,
   identify which project this session is about. If unclear, fetch all projects with
   `curl -s http://localhost:7777/memory/projects 2>/dev/null` and ask the user.
2. **Read brain (project-scoped)** — `curl -s "http://localhost:7777/memory/context?project=<active-project>" 2>/dev/null`.
   If the server responds, internalize the markdown. If it's down, skip silently.
3. **Check for resumable missions** — `curl -s "http://localhost:7777/missions/resume?project=<active-project>" 2>/dev/null`.
   If there are active missions with pending tasks from a previous session, surface them to the user.
```

### 2. Brain writes during work

Tell Claude when and how to write entries:

```markdown
## Brain server sync
- The brain server runs at `http://localhost:7777`. POST to `/memory` to record context that persists across sessions.
- **When to write:** architectural decisions, working style observations, agent rule changes, decision resolutions.
  If it would matter in a future session, write it.
- **When not to write:** ephemeral task details, things already in code/git, duplicates of what's already stored.
- **Format:**

  curl -s -X POST http://localhost:7777/memory \
    -H "Content-Type: application/json" \
    -d '{
      "section": "<section>",
      "action": "<action>",
      "value": "<value>",
      "source": "claude-session",
      "sessionId": "<session-id>",
      "project": ["<project-id>"]
    }'

  - Sections: `workingStyle`, `architecture`, `agentRules`, `decisions`.
  - Actions: `add`, `remove`, `update` (for lists). For decisions, value is
    `{"decision":"...","status":"open|resolved"}`.
  - Always include `project` — an array of project IDs this entry belongs to.
- **Search before writing.** `curl -s "http://localhost:7777/memory/search?q=keyword"` — check for duplicates.
- **Conflict check before adding.** `curl -s -X POST http://localhost:7777/memory/check -H "Content-Type: application/json" -d '{"value":"<proposed entry>"}'`.
  If conflicts are returned, surface them to the user before proceeding.
- **Fire and forget.** If the server is down, skip silently — don't retry or mention it.
```

### 3. Mission tracking (cross-session persistence)

Missions let multi-step work survive across sessions. If a session crashes, the next one picks up where it left off.

```markdown
## Mission-driven orchestration
- **Create a mission for non-trivial work** (3+ steps):
  
  curl -s -X POST http://localhost:7777/missions \
    -H "Content-Type: application/json" \
    -d '{
      "name": "<mission name>",
      "project": "<active-project>",
      "sessionId": "<session-id>",
      "tasks": [{"description": "<task 1>"}, {"description": "<task 2>"}]
    }'

- **Update task status as work progresses:**
  - Start: `PATCH /missions/<id>/tasks/<taskId>` with `{"status":"in_progress","assignedAgent":"<name>","sessionId":"<id>"}`
  - Complete: `PATCH` with `{"status":"completed","output":"<1-2 sentence summary>"}`
  - Block: `PATCH` with `{"status":"blocked","blockers":["<what is blocking>"]}`
- **Resume on session start.** The startup step checks `/missions/resume?project=<id>`.
  If resumable work exists, pick up the next pending task instead of re-planning.
- **Keep task output concise.** Enough for the next session to understand what was done
  without re-reading the code.
```

### 4. Brain-driven orchestration (optional, advanced)

For teams that want Claude to factor past decisions into planning:

```markdown
## Brain-driven orchestration
- **Pre-task brain query.** Before starting non-trivial tasks, search the brain:
  `curl -s "http://localhost:7777/memory/search?q=<keywords>&project=<active-project>"`.
  Factor results into planning — don't contradict past decisions without flagging it.
- **Auto-write on decision points.** When a decision is made (architecture choice, tool selection,
  pattern adoption), immediately POST it as a decision with `"confidence":"tentative"`.
  Mark as `firm` once the user confirms.
- **Post-task brain diff.** After completing a task, POST to `/memory/diff` with facts/decisions
  from the task. The server returns which ones are missing. Write the missing ones.
```

### 5. Agent context injection (optional)

To pass brain context to subagents, create a helper script at `~/.claude/brain-context.sh`:

```bash
#!/usr/bin/env bash
# Usage: bash brain-context.sh [project-id]
#        bash brain-context.sh --mission <mission-id>

URL="http://localhost:7777/memory/context"

if [ "$1" = "--mission" ] && [ -n "$2" ]; then
  URL="${URL}?mission=${2}"
elif [ -n "$1" ]; then
  URL="${URL}?project=${1}"
fi

CONTEXT=$(curl -s --max-time 2 "$URL" 2>/dev/null)
if [ -n "$CONTEXT" ]; then
  echo ""
  echo "## Project Brain Context"
  echo "(Auto-injected from brain server. Respect these decisions and rules.)"
  echo ""
  echo "$CONTEXT"
fi
```

Then in your `CLAUDE.md`, instruct Claude to inject brain context when spawning agents:

```markdown
- **Inject brain into agent prompts.** Run `bash ~/.claude/brain-context.sh <active-project>`
  and append the output to the agent's prompt as a "Project context" section.
```

### Setting up projects

Projects scope brain entries so different repos/workstreams don't pollute each other. Create them via the API:

```bash
curl -s -X POST http://localhost:7777/memory/projects \
  -H "Content-Type: application/json" \
  -d '{"id": "my-project", "name": "My Project", "repos": ["MyRepo"], "status": "active"}'
```

Then reference the project ID in your `CLAUDE.md` session startup mappings (e.g., "working in MyRepo -> `my-project`").

A "General" project is created by default for cross-cutting entries.

## Tech stack

- **Server:** Express 5, plain JS (ESM)
- **Client:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack React Query, shadcn/ui
