# Brain hooks setup

Brain-coupled Claude Code hooks that pre-register the session and clean up afterwards. They run as the user's hooks, but live in this repo as the source of truth — `~/.claude/settings.json` points at these absolute paths so edits to the repo file take effect immediately on next SessionStart / SessionEnd. No copy step, no drift.

## Files

- `hooks/claude-startup.sh` — `SessionStart` hook. Registers the session early via `POST /sessions/startup` (when `source == "startup"`), caches the response to `~/.claude/sessions/<id>.startup-response`. Includes subagent guard, source filter (skips POST on `resume` / `clear` / `compact` so the cache isn't corrupted by a Phase 3 409 body), and brain-down failsafe (`exit 0` on every error path, `curl --max-time 5`).
- `hooks/session-cleanup.sh` — `SessionEnd` hook. Removes per-session files (`.label`, `.startup`, `.startup-response`) and the legacy shared `current-session-id` / `enforcement-override`.

## Install

Add the following to `~/.claude/settings.json` under the existing `"hooks"` object. Replace `<ABSOLUTE-PATH-TO-CLONE>` with the absolute path to your `brain-app` clone (e.g., `C:/Users/you/code/brain-app` or `/home/you/code/brain-app`).

```json
"SessionStart": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "bash <ABSOLUTE-PATH-TO-CLONE>/setup/hooks/claude-startup.sh"
      }
    ]
  }
],
"SessionEnd": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "bash <ABSOLUTE-PATH-TO-CLONE>/setup/hooks/session-cleanup.sh"
      }
    ]
  }
]
```

Restart Claude Code. The next session will register early via the hook and cache the startup response.

## Companion CLAUDE.md change

The hook only writes the cache. Reading the cache happens in your top-level `CLAUDE.md` startup steps. The cache-aware step 3 + split step 4 + PATCH-on-cache-hit substep are described in the RFC (`docs/session-startup-hook.md`, "CLAUDE.md changes preview" section). Without the CLAUDE.md update, the hook still works (rows are pre-registered server-side), but Claude won't read from the cache.

## What stays in `~/.claude/`

- `brain-token` — your Bearer token. Never check this in. Required by `brain-auth-header.sh` which the hooks call.
- `brain-auth-header.sh`, `brain-context.sh` — helper scripts. Planned to migrate in a follow-up.
- Personal stuff: `statusline-command.sh`, `slack-notify.sh` (your Slack webhook), and any other workflow you haven't shared.

## Reference

Full design rationale, source filter logic, label/project null handling, defense-in-depth, and rollout safety: `docs/session-startup-hook.md`.
