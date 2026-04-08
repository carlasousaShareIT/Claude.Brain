// routes/observer.js — Observer system routes

import { Router } from "express";
import {
  watchAgent,
  unwatchAgent,
  getActiveWatchers,
  getObserverConfig,
  setObserverConfig,
} from "../observer/watcher.js";
import {
  listViolations,
  getViolationRateByAgent,
  findInProgressTaskForAgent,
} from "../db-store.js";
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
