#!/bin/bash
# SessionStart hook: early session registration + startup-response cache.
# Non-blocking: exits 0 on any failure. Never modifies tool execution.
#
# Lives in brain-app/setup/hooks/. ~/.claude/settings.json points here directly
# (Option C — repo file is the live file). Edit here, takes effect immediately.

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
