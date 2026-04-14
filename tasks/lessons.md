# Lessons

## 2026-04-01: Always run reviewer before marking tasks complete
**What happened:** Completed the entire SQLite migration (db.js, db-store.js, migrate-json-to-db.js, all 11 route files) and marked mission tasks as complete without running a review pass.
**What was missed:** Reviewer found 2 critical bugs (archived decisions lose status on round-trip) and 1 bug (tags field missing from rowToEntry). These would have silently corrupted data.
**Rule:** The brain agent rules already say: "After any brain-app code changes, the orchestrator must run a review pass — read changed files, check for regressions, run npm run build — before marking the task complete." Follow this every time, no exceptions.
