// routes/sessions.js — structured session lifecycle tracking

import { Router } from "express";
import { startSession, endSession, getSessionById, listSessions, getLatestHandoff } from "../db-store.js";
import { broadcastEvent } from "../broadcast.js";

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
  const session = endSession(req.params.id, { handoff });
  if (!session) return res.status(404).json({ error: "Session not found" });
  broadcastEvent("session:end", { id: req.params.id, ts: new Date().toISOString() });
  console.log(`[brain] session:end ${req.params.id}`);
  res.json(session);
});

// GET / — list sessions
router.get("/", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const project = req.query.project || undefined;
  res.json(listSessions({ limit, project }));
});

// GET /latest/handoff — most recent handoff for continuity
router.get("/latest/handoff", (req, res) => {
  const result = getLatestHandoff();
  if (!result) return res.status(404).json({ error: "No sessions with handoff found" });
  res.json(result);
});

// GET /:id — single session
router.get("/:id", (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

export default router;
