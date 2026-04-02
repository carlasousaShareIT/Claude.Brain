// routes/agents.js — agent output registry

import { Router } from "express";
import {
  createAgentResult,
  getAgentResults,
  getAgentResult,
  deleteAgentResult,
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /agents/results — store agent output
router.post("/results", (req, res) => {
  const { agent, sessionId, missionId, taskId, branch, worktreePath, changedFiles, summary } = req.body;

  if (!agent) return res.status(400).json({ error: "Missing agent" });
  if (!summary) return res.status(400).json({ error: "Missing summary" });

  const result = createAgentResult({ agent, sessionId, missionId, taskId, branch, worktreePath, changedFiles, summary });
  const now = new Date().toISOString();

  broadcastEvent("agent-result-created", { result, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "agent-result-created", "agents", `${agent}: ${summary}`);
  console.log(`[brain] agent result created: ${result.id} — ${agent}`);
  res.status(201).json(result);
});

// GET /agents/results — list results
router.get("/results", (req, res) => {
  const sessionId = req.query.session || undefined;
  const agent = req.query.agent || undefined;
  const missionId = req.query.mission || undefined;
  const results = getAgentResults({ sessionId, agent, missionId });
  res.json(results);
});

// GET /agents/results/:id — single result
router.get("/results/:id", (req, res) => {
  const result = getAgentResult(req.params.id);
  if (!result) return res.status(404).json({ error: "Agent result not found" });
  res.json(result);
});

// DELETE /agents/results/:id — delete a result
router.delete("/results/:id", (req, res) => {
  const deleted = deleteAgentResult(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Agent result not found" });

  broadcastEvent("agent-result-deleted", { id: req.params.id, ts: new Date().toISOString() });
  fireWebhooks({ webhooks: getWebhooks() }, "agent-result-deleted", "agents", req.params.id);
  console.log(`[brain] agent result deleted: ${req.params.id}`);
  res.json({ ok: true });
});

export default router;
