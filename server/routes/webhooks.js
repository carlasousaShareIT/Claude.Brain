// routes/webhooks.js — webhook registration and management

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";

const router = Router();

// POST /memory/webhooks — register a webhook
router.post("/memory/webhooks", (req, res) => {
  const { url, events } = req.body;
  if (!url || !events || !Array.isArray(events)) return res.status(400).json({ error: "Missing url or events array" });

  const brain = loadBrain();
  const exists = brain.webhooks.some(wh => wh.url === url);
  if (exists) return res.status(409).json({ error: "Webhook already registered" });

  brain.webhooks.push({ url, events });
  saveBrain(brain);
  console.log(`[brain] webhook registered: ${url} — events: ${events.join(", ")}`);
  res.json({ ok: true });
});

// DELETE /memory/webhooks — remove a webhook
router.delete("/memory/webhooks", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const brain = loadBrain();
  const before = brain.webhooks.length;
  brain.webhooks = brain.webhooks.filter(wh => wh.url !== url);
  if (brain.webhooks.length === before) return res.status(404).json({ error: "Webhook not found" });

  saveBrain(brain);
  console.log(`[brain] webhook removed: ${url}`);
  res.json({ ok: true });
});

// GET /memory/webhooks — list registered webhooks
router.get("/memory/webhooks", (req, res) => {
  const brain = loadBrain();
  res.json(brain.webhooks || []);
});

export default router;
