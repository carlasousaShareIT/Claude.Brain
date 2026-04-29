// routes/observer.js — Observer system routes

import { Router } from "express";
import {
  watchAgent,
  unwatchAgent,
  getActiveWatchers,
  getStuckAgents,
  getObserverConfig,
  setObserverConfig,
} from "../observer/watcher.js";
import {
  listViolations,
  clearViolations,
  getViolationRateByAgent,
  findInProgressTaskForAgent,
  listAgentMetrics,
  getAgentMetricsSummary,
  recordSessionActivity,
  validateSessionOwnership,
} from "../db-store.js";
import { getDb } from "../db.js";
import { broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /agent-started — SubagentStart hook (accepts both custom and Claude Code payloads)
router.post("/agent-started", (req, res) => {
  const sessionId = req.body.sessionId || req.body.session_id;
  const agentId = req.body.agentId || req.body.agent_id;
  const agentType = req.body.agentType || req.body.agent_type;

  if (!sessionId || !agentId) return res.status(400).json({ error: "Missing sessionId or agentId" });

  broadcastEvent("agent-started", {
    sessionId,
    agentId,
    agentType: agentType || "unknown",
    ts: new Date().toISOString(),
  });

  // Record agent_spawn activity
  if (sessionId) {
    try {
      const v = validateSessionOwnership(sessionId, req.user?.id, !!req.user?.isBootstrap);
      if (!v.valid) {
        console.warn(`[brain] skipping session_activity write for ${sessionId}: ${v.reason}`);
      } else {
        recordSessionActivity(sessionId, "agent_spawn", agentType || agentId || "unknown");
      }
    } catch {}
  }

  console.log(`[observer] agent started: ${agentId} (${agentType || "unknown"}) in session ${sessionId}`);
  res.json({ ok: true });
});

// POST /agent-stopped — SubagentStop hook (accepts both custom and Claude Code payloads)
router.post("/agent-stopped", (req, res) => {
  const sessionId = req.body.sessionId || req.body.session_id;
  const agentId = req.body.agentId || req.body.agent_id;
  const agentType = req.body.agentType || req.body.agent_type;
  const transcriptPath = req.body.agent_transcript_path || req.body.transcriptPath;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  // Enrich the dir-watcher's entry with the real agent name if we can match by path
  if (transcriptPath && (agentType || agentId)) {
    const watchers = getActiveWatchers();
    const normalPath = transcriptPath.replace(/\\/g, "/");
    const match = watchers.find(w => w.jsonlPath.replace(/\\/g, "/") === normalPath);
    if (match && match.agentName === "subagents") {
      // Dir-watcher registered with generic name — update it via unwatch + re-watch
      const label = agentType || agentId;
      unwatchAgent(match.sessionId, match.agentName);
      watchAgent({ sessionId: match.sessionId, jsonlPath: transcriptPath, agentName: label });
    }
  }

  broadcastEvent("agent-stopped", {
    sessionId,
    agentId: agentId || null,
    agentType: agentType || "unknown",
    transcriptPath: transcriptPath || null,
    ts: new Date().toISOString(),
  });

  // Record reviewer_run if agent type matches
  if (sessionId && agentType && /review/i.test(agentType)) {
    try {
      const v = validateSessionOwnership(sessionId, req.user?.id, !!req.user?.isBootstrap);
      if (!v.valid) {
        console.warn(`[brain] skipping session_activity write for ${sessionId}: ${v.reason}`);
      } else {
        recordSessionActivity(sessionId, "reviewer_run", agentId || agentType);
      }
    } catch {}
  }

  console.log(`[observer] agent stopped: ${agentId || "unknown"} (${agentType || "unknown"}) in session ${sessionId}`);
  res.json({ ok: true });
});

// POST /watch — start watching an agent's JSONL log
router.post("/watch", (req, res) => {
  let { sessionId, jsonlPath, agentName, missionId, taskId, profile } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
  if (!jsonlPath) return res.status(400).json({ error: "Missing jsonlPath" });
  if (!agentName) return res.status(400).json({ error: "Missing agentName" });

  // Auto-resolve missionId/taskId from in-progress mission tasks
  if (!missionId || !taskId) {
    const match = findInProgressTaskForAgent(agentName, sessionId);
    if (match) {
      missionId = missionId || match.missionId;
      taskId = taskId || match.taskId;
    }
  }

  const result = watchAgent({ sessionId, jsonlPath, agentName, missionId, taskId, profile });
  if (result.error) {
    return res.status(409).json(result);
  }

  console.log(`[observer] POST /watch — ${sessionId}:${agentName}`);
  res.status(201).json(result);
});

// POST /unwatch — stop watching an agent
router.post("/unwatch", (req, res) => {
  const { sessionId, agentName } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
  if (!agentName) return res.status(400).json({ error: "Missing agentName" });

  const result = unwatchAgent(sessionId, agentName);
  if (!result) {
    return res.status(404).json({ error: "Watcher not found" });
  }

  console.log(`[observer] POST /unwatch — ${sessionId}:${agentName}`);
  res.json(result);
});

// GET /watchers — list active watchers
router.get("/watchers", (req, res) => {
  res.json(getActiveWatchers());
});

// GET /violations — list violations with filters
router.get("/violations", (req, res) => {
  const sessionId = req.query.session || undefined;
  const agentName = req.query.agent || undefined;
  const missionId = req.query.mission || undefined;
  const type = req.query.type || undefined;
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

  res.json(listViolations({ sessionId, agentName, missionId, type, limit }));
});

// GET /violations/stats — aggregate violation rates by agent and type
router.get("/violations/stats", (req, res) => {
  res.json(getViolationRateByAgent());
});

// GET /stuck — currently-stuck agents (for orchestrator polling)
router.get("/stuck", (req, res) => {
  const stuck = getStuckAgents();
  res.json({ count: stuck.length, agents: stuck });
});

// DELETE /violations — clear violations with optional filters
router.delete("/violations", (req, res) => {
  const type = req.query.type || undefined;
  const before = req.query.before || undefined;
  const result = clearViolations({ type, before });
  console.log(`[observer] cleared ${result.deleted} violation(s)${type ? ` (type=${type})` : ""}${before ? ` (before=${before})` : ""}`);
  res.json(result);
});

// GET /metrics — list agent metrics with filters
router.get("/metrics", (req, res) => {
  const sessionId = req.query.session || undefined;
  const agentName = req.query.agent || undefined;
  const missionId = req.query.mission || undefined;
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
  res.json(listAgentMetrics({ sessionId, agentName, missionId, limit }));
});

// GET /metrics/summary — agent metrics with session context
router.get("/metrics/summary", (req, res) => {
  const agentName = req.query.agent || undefined;
  res.json(getAgentMetricsSummary({ agentName }));
});

// DELETE /metrics — clear agent metrics with optional filters
router.delete("/metrics", (req, res) => {
  const db = getDb();
  let sql = "DELETE FROM agent_metrics WHERE 1=1";
  const params = [];
  if (req.query.session) { sql += " AND session_id = ?"; params.push(req.query.session); }
  if (req.query.agent) { sql += " AND agent_name = ?"; params.push(req.query.agent); }
  if (req.query.before) { sql += " AND created_at < ?"; params.push(req.query.before); }
  const result = db.prepare(sql).run(...params);
  console.log(`[observer] cleared ${result.changes} agent metric(s)`);
  res.json({ deleted: result.changes });
});

// GET /config — read observer config (calibration mode)
router.get("/config", (req, res) => {
  res.json(getObserverConfig());
});

// PATCH /config — update observer config
router.patch("/config", (req, res) => {
  const updated = setObserverConfig(req.body);
  console.log(`[observer] config updated: mode=${updated.mode}`);
  res.json(updated);
});

export default router;
