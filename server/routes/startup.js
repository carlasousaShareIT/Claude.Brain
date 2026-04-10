// routes/startup.js — compound session startup endpoint

import { Router } from "express";
import {
  startSession,
  getLatestHandoff,
  getContextMarkdown,
  getResumableMissions,
  recordSessionActivity,
  getSessionCompliance,
} from "../db-store.js";
import { getDb } from "../db.js";
import { broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /sessions/startup — compound startup: register session + get all context in one call
router.post("/startup", (req, res) => {
  const { sessionId, label, project } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  // 1. Register session
  const session = startSession({ id: sessionId, label, project });
  broadcastEvent("session:start", { id: sessionId, label, project, ts: new Date().toISOString() });
  console.log(`[brain] session:startup ${sessionId}${label ? ` (${label})` : ""}`);

  // 2. Get latest handoff for this project
  let handoff = null;
  try {
    handoff = getLatestHandoff(project);
    // Don't return the current session's handoff (it won't have one yet)
    if (handoff && handoff.id === sessionId) handoff = null;
  } catch {}

  // 3. Get brain context
  const contextResult = getContextMarkdown({
    projectId: project || undefined,
    format: "compact",
  });
  const context = typeof contextResult === "string" ? contextResult : contextResult;

  // 4. Record brain_query activity (startup includes reading context)
  recordSessionActivity(sessionId, "brain_query", "startup");

  // 5. Get resumable missions
  const resumable = getResumableMissions(project || undefined);

  // 6. Get pending reminders
  const db = getDb();
  const ts = new Date().toISOString();
  const reminders = db.prepare(
    "SELECT * FROM reminders WHERE status = 'pending' OR (status = 'snoozed' AND snoozed_until <= ?)"
  ).all(ts).map(r => ({
    id: r.id,
    text: r.text,
    priority: r.priority || "normal",
    dueDate: r.due_date,
    project: JSON.parse(r.project || "[]"),
  }));
  // Filter by project if specified
  const filteredReminders = project
    ? reminders.filter(r => r.project.length === 0 || r.project.includes(project))
    : reminders;

  // 7. Get initial compliance state
  const compliance = getSessionCompliance(sessionId);

  res.json({
    session,
    handoff,
    context,
    resumable: { missions: resumable },
    reminders: filteredReminders,
    compliance,
  });
});

export default router;
