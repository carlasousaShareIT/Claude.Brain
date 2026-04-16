// routes/startup.js — compound session startup endpoint

import { Router } from "express";
import {
  startSession,
  getLatestHandoff,
  getContextMarkdown,
  getResumableMissions,
  recordSessionActivity,
  getSessionCompliance,
  getSessionById,
} from "../db-store.js";
import { getDb } from "../db.js";
import { broadcastEvent } from "../broadcast.js";

const router = Router();

// ---------------------------------------------------------------------------
// Plain text formatter — renders startup data as compact markdown
// ---------------------------------------------------------------------------

const STATUS_ICON = {
  pending: "○",
  in_progress: "▶",
  blocked: "✗",
  interrupted: "⏸",
  verification_failed: "!",
  completed: "✓",
};

const truncId = (id, len = 30) =>
  id && id.length > len ? id.slice(0, len) + "..." : id;

const truncDesc = (desc, len = 120) =>
  desc && desc.length > len ? desc.slice(0, len) + "..." : desc;

const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

function formatStartupText({ session, handoff, previousHealth, context, resumable, reminders, compliance }) {
  const lines = [];

  // -- Session header
  lines.push(`# Session started`);
  lines.push(`${session.label || "unnamed"} | ${session.project || "general"} | ${session.started_at || "now"}`);
  lines.push("");

  // -- Handoff from previous session
  if (handoff && handoff.handoff) {
    const h = handoff.handoff;
    const fromLabel = handoff.label || "unknown";
    const ended = handoff.ended_at ? `, ended: ${handoff.ended_at}` : "";
    lines.push(`## Handoff (from: ${fromLabel}${ended})`);
    for (const key of ["done", "remaining", "blocked", "decisions"]) {
      const items = h[key];
      if (!items || items.length === 0) continue;
      lines.push(`### ${key.charAt(0).toUpperCase() + key.slice(1)}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
  }

  // -- Previous session health
  if (previousHealth) {
    lines.push(`## Previous session health`);
    const parts = [
      `${previousHealth.toolCalls} tool calls`,
      `${previousHealth.tasksCompleted} tasks completed`,
      previousHealth.endedCleanly ? "ended cleanly" : "did NOT end cleanly",
    ];
    lines.push(parts.join(" | "));
    lines.push("");
  }

  // -- Resumable missions
  const missions = resumable?.missions?.missions || resumable?.missions || [];
  if (missions.length > 0) {
    lines.push(`## Resumable missions`);
    for (const m of missions) {
      lines.push(`### ${m.name} (${truncId(m.id)})`);
      const counts = [
        m.completedTasks && `${m.completedTasks} done`,
        m.pendingTasks && `${m.pendingTasks} pending`,
        m.inProgressTasks && `${m.inProgressTasks} in progress`,
        m.blockedTasks && `${m.blockedTasks} blocked`,
        m.interruptedTasks && `${m.interruptedTasks} interrupted`,
      ].filter(Boolean);
      lines.push(counts.join(" | "));
      for (const t of m.tasks || []) {
        const icon = STATUS_ICON[t.status] || "○";
        const desc = truncDesc(t.description);
        const phase = t.phase ? ` [${t.phase}]` : "";
        lines.push(`- ${icon} ${desc}${phase} [${truncId(t.id)}]`);
      }
      lines.push("");
    }
  }

  // -- Reminders
  if (reminders && reminders.length > 0) {
    lines.push(`## Reminders (${reminders.length} pending)`);
    for (const r of reminders) {
      const overdue = isOverdue(r.dueDate) ? "[overdue] " : "";
      const priority = r.priority === "high" ? "[high] " : "";
      const due = r.dueDate ? ` (due: ${r.dueDate.slice(0, 10)})` : "";
      lines.push(`- ${overdue}${priority}${r.text}${due} [${r.id}]`);
    }
    lines.push("");
  }

  // -- Compliance
  if (compliance) {
    const c = compliance.checks;
    const parts = [
      `brain_query: ${c.brain_query_gate}`,
      `agent_profile: ${c.agent_profile_gate}`,
      `reviewer: ${c.reviewer_gate === "not_applicable" ? "n/a" : c.reviewer_gate}`,
    ];
    lines.push(`## Compliance`);
    lines.push(parts.join(" | "));
    lines.push("");
  }

  // -- Brain context (already compact markdown)
  if (context) {
    lines.push(`## Brain context`);
    lines.push(context);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// POST /sessions/startup — compound startup: register session + get all context in one call
// ---------------------------------------------------------------------------
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
    if (handoff && handoff.id === sessionId) handoff = null;
  } catch {}

  // 2.5. Get previous session health snapshot
  let previousHealth = null;
  try {
    if (handoff && handoff.id) {
      const prevSession = getSessionById(handoff.id);
      if (prevSession) {
        previousHealth = {
          sessionId: handoff.id,
          label: handoff.label || null,
          toolCalls: prevSession.tool_call_count || 0,
          tasksCompleted: prevSession.task_completed_count || 0,
          endedCleanly: !!prevSession.ended_at,
        };
      }
    }
  } catch {}

  // 3. Get brain context
  const context = getContextMarkdown({
    projectId: project || undefined,
    format: "compact",
  });

  // 4. Record brain_query activity
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
  const filteredReminders = project
    ? reminders.filter(r => r.project.length === 0 || r.project.includes(project))
    : reminders;

  // 7. Get initial compliance state
  const compliance = getSessionCompliance(sessionId);

  // Return plain text by default, JSON with ?format=json
  const format = req.query.format || req.body.format;
  if (format === "json") {
    return res.json({
      session,
      handoff,
      previousHealth,
      context,
      resumable: { missions: resumable },
      reminders: filteredReminders,
      compliance,
    });
  }

  const text = formatStartupText({
    session,
    handoff,
    previousHealth,
    context,
    resumable,
    reminders: filteredReminders,
    compliance,
  });
  res.type("text/plain").send(text);
});

export default router;
