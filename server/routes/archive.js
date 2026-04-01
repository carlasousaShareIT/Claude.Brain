// routes/archive.js — archive, unarchive, and archived listing

import { Router } from "express";
import { archiveEntry, getArchived, unarchiveEntry, getWebhooks } from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /memory/archive — move entry to archived
router.post("/memory/archive", (req, res) => {
  const { section, text } = req.body;
  if (!section || !text) return res.status(400).json({ error: "Missing section or text" });

  if (section !== "decisions" && !["workingStyle", "architecture", "agentRules"].includes(section)) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  const result = archiveEntry(section, text);
  if (!result) return res.status(404).json({ error: "Entry not found" });

  fireWebhooks({ webhooks: getWebhooks() }, "archive", section, text);
  broadcastEvent("archive", { section, text, action: "archive", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] archived from ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true });
});

// GET /memory/archived — list archived entries
router.get("/memory/archived", (req, res) => {
  res.json(getArchived());
});

// POST /memory/unarchive — move entry back from archived to its original section
router.post("/memory/unarchive", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const result = unarchiveEntry(text);
  if (!result) return res.status(404).json({ error: "Entry not found in archive" });

  const { section } = result;
  fireWebhooks({ webhooks: getWebhooks() }, "add", section, text);
  broadcastEvent("unarchive", { section, text, action: "unarchive", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] unarchived to ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true, section });
});

export default router;
