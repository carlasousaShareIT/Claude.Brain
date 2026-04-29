// routes/sessions.js — structured session lifecycle tracking

import { Router } from "express";
import { startSession, endSession, updateSession, updateSessionHandoff, getSessionById, listSessions, getLatestHandoff, searchSessions, getSessionCompliance, recordSessionActivity, validateSessionOwnership, getSessionsHealth, getSessionHealth, heartbeatSession } from "../db-store.js";
import { broadcastEvent } from "../broadcast.js";
import { unwatchAllForSession } from "../observer/watcher.js";

const router = Router();

// POST /start — record session start
router.post("/start", (req, res) => {
  const { id, label, project } = req.body;
  if (!id) return res.status(400).json({ error: "Missing session id" });
  const session = startSession({ id, label, project });
  broadcastEvent("session:start", { id, label, project, ts: new Date().toISOString() });
  console.log(`[brain] session:start ${id}${label ? ` (${label})` : ""}`);
  res.json(session);
});

// POST /:id/end — record session end with optional handoff
router.post("/:id/end", (req, res) => {
  const { handoff } = req.body || {};
  const existing = getSessionById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Session not found" });

  if (existing.ended_at) {
    // Session already ended — update handoff if provided, 409 otherwise
    if (!handoff) return res.status(409).json({ error: `Session ${req.params.id} already ended at ${existing.ended_at}` });
    const updated = updateSessionHandoff(req.params.id, handoff);
    broadcastEvent("session:handoff-updated", { id: req.params.id, ts: new Date().toISOString() });
    console.log(`[brain] session:handoff-updated ${req.params.id} (via end, session already ended)`);
    return res.json(updated);
  }

  // Session open — end it with full side effects
  const session = endSession(req.params.id, { handoff });

  // Unwatch all agents for this session
  const unwatchResults = unwatchAllForSession(req.params.id);
  if (unwatchResults.length > 0) {
    console.log(`[brain] session:end ${req.params.id} — unwatched ${unwatchResults.length} agent(s)`);
  }

  broadcastEvent("session:end", { id: req.params.id, ts: new Date().toISOString() });
  console.log(`[brain] session:end ${req.params.id}`);
  res.json(session);
});

// PATCH /:id/handoff — update handoff data regardless of session state
router.patch("/:id/handoff", (req, res) => {
  const { handoff } = req.body || {};
  if (!handoff) return res.status(400).json({ error: "Missing handoff data" });
  const session = updateSessionHandoff(req.params.id, handoff);
  if (!session) return res.status(404).json({ error: "Session not found" });
  broadcastEvent("session:handoff-updated", { id: req.params.id, ts: new Date().toISOString() });
  console.log(`[brain] session:handoff-updated ${req.params.id}`);
  res.json(session);
});

// GET / — list sessions
router.get("/", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const project = req.query.project || undefined;
  res.json(listSessions({ limit, project }));
});

// GET /search — search across session handoffs, labels, and projects
router.get("/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing q parameter" });
  const project = req.query.project || undefined;
  res.json(searchSessions(q, project));
});

// GET /latest/handoff — most recent handoff for continuity
router.get("/latest/handoff", (req, res) => {
  const project = req.query.project || undefined;
  const result = getLatestHandoff(project);
  if (!result) return res.status(404).json({ error: "No sessions with handoff found" });
  res.json(result);
});

// GET /health — aggregate health across recent sessions
router.get("/health", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(getSessionsHealth(limit));
});

// GET /:id/health — single session health detail
router.get("/:id/health", (req, res) => {
  const result = getSessionHealth(req.params.id);
  if (!result) return res.status(404).json({ error: "Session not found" });
  res.json(result);
});

// GET /:id/compliance — check session compliance state for enforcement hooks
router.get("/:id/compliance", (req, res) => {
  const compliance = getSessionCompliance(req.params.id);
  res.json(compliance);
});

// POST /:id/activity — record session activity (used by hooks and other tools)
router.post("/:id/activity", (req, res) => {
  const { type, details } = req.body;
  if (!type) return res.status(400).json({ error: "Missing type" });
  const validTypes = ["brain_query", "brain_write", "profile_inject", "reviewer_run", "agent_spawn", "commit"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  try {
    const v = validateSessionOwnership(req.params.id, req.user?.id, !!req.user?.isBootstrap);
    if (!v.valid) {
      console.warn(`[brain] skipping session_activity write for ${req.params.id}: ${v.reason}`);
    } else {
      recordSessionActivity(req.params.id, type, details || null);
    }
  } catch {}
  res.json({ ok: true });
});

// POST /:id/heartbeat — increment tool call counter, return health status
router.post("/:id/heartbeat", (req, res) => {
  const { toolName } = req.body || {};
  const result = heartbeatSession(req.params.id, toolName);
  if (!result) return res.status(404).json({ error: "Session not found" });
  res.json(result);
});

// PATCH /:id — update session metadata (label, project)
router.patch("/:id", (req, res) => {
  const { label, project } = req.body;
  const session = updateSession(req.params.id, { label, project });
  if (!session) return res.status(404).json({ error: "Session not found" });
  console.log(`[brain] session updated: ${req.params.id} — project=${project || "(unchanged)"}`);
  res.json(session);
});

// GET /:id — single session
router.get("/:id", (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

export default router;
