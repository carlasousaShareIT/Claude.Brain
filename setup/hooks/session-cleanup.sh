#!/bin/bash
# SessionEnd hook: cleans up per-session files (.label, .startup, .startup-response)
# and legacy shared files (current-session-id, enforcement-override).
#
# Lives in brain-app/setup/hooks/. ~/.claude/settings.json points here directly.
INPUT=$(cat)
echo "$INPUT" | python3 -c "
import sys, json, os
data = json.load(sys.stdin)
session_id = data.get('session_id', '')
if session_id:
    for suffix in ('.label', '.startup', '.startup-response'):
        f = os.path.expanduser(f'~/.claude/sessions/{session_id}{suffix}')
        if os.path.isfile(f):
            os.remove(f)
# Clean up current-session-id
sid_file = os.path.expanduser('~/.claude/current-session-id')
if os.path.isfile(sid_file):
    os.remove(sid_file)
# Clean up enforcement override
override_file = os.path.expanduser('~/.claude/enforcement-override')
if os.path.isfile(override_file):
    os.remove(override_file)
"
