// routes/webhooks.js — webhook registration and management

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";

const router = Router();

// Validate a webhook URL: must be http/https, no private IPs or cloud metadata endpoints
const validateWebhookUrl = (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "URL must use http or https";
  }
  const host = parsed.hostname;
  // Block cloud metadata endpoint
  if (host === "169.254.169.254") return "Blocked: cloud metadata endpoint";
  // Block private network ranges (10.x, 172.16-31.x, 192.168.x) and link-local (169.254.x)
  const privateRanges = [
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^169\.254\.\d+\.\d+$/,
  ];
  if (privateRanges.some(r => r.test(host))) {
    return "Blocked: private network address";
  }
  return null;
};

// POST /memory/webhooks — register a webhook
router.post("/memory/webhooks", (req, res) => {
  const { url, events } = req.body;
  if (!url || !events || !Array.isArray(events)) return res.status(400).json({ error: "Missing url or events array" });

  const urlError = validateWebhookUrl(url);
  if (urlError) return res.status(400).json({ error: urlError });

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
