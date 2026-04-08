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

const router = Router();

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
