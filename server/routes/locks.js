// routes/locks.js — file lock registry for agent coordination

import { Router } from "express";
import {
  claimLocks,
  releaseLocks,
  getLocks,
  forceReleaseLock,
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /locks/claim — claim lock(s) on files
router.post("/claim", (req, res) => {
  const { files, agent, sessionId } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Missing or empty files array" });
  }
  if (!agent) return res.status(400).json({ error: "Missing agent" });

  const result = claimLocks(files, agent, sessionId);

  if (!result.ok) {
    return res.status(409).json({ error: "Lock conflict", conflicts: result.conflicts });
  }

  const now = new Date().toISOString();
  broadcastEvent("lock-claimed", { locks: result.locks, agent, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "lock-claimed", "locks", `${agent} claimed ${files.length} file(s)`);
  console.log(`[brain] locks claimed: ${agent} → ${files.join(", ")}`);
  res.status(201).json(result.locks);
});

// POST /locks/release — release lock(s) by file list or agent
router.post("/release", (req, res) => {
  const { files, agent } = req.body;

  if (!files && !agent) {
    return res.status(400).json({ error: "Must provide files or agent (or both)" });
  }

  const result = releaseLocks({ files, agent });

  const now = new Date().toISOString();
  broadcastEvent("lock-released", { files, agent, released: result.released, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "lock-released", "locks", `${result.released} lock(s) released`);
  console.log(`[brain] locks released: ${result.released} (agent=${agent || "any"}, files=${files ? files.join(", ") : "any"})`);
  res.json({ released: result.released });
});

// GET /locks — list all active (non-expired) locks
router.get("/", (req, res) => {
  const agent = req.query.agent || undefined;
  const file = req.query.file || undefined;
  const locks = getLocks({ agent, file });
  res.json(locks);
});

// DELETE /locks/:id — force-release a specific lock
router.delete("/:id", (req, res) => {
  const released = forceReleaseLock(req.params.id);
  if (!released) return res.status(404).json({ error: "Lock not found" });

  const now = new Date().toISOString();
  broadcastEvent("lock-released", { id: req.params.id, forced: true, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "lock-released", "locks", `Lock ${req.params.id} force-released`);
  console.log(`[brain] lock force-released: ${req.params.id}`);
  res.json({ ok: true });
});

export default router;
