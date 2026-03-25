// routes/archive.js — archive, unarchive, and archived listing

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { entryText } from "../entry-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /memory/archive — move entry to archived
router.post("/memory/archive", (req, res) => {
  const { section, text } = req.body;
  if (!section || !text) return res.status(400).json({ error: "Missing section or text" });

  const brain = loadBrain();
  let entry = null;

  if (section === "decisions") {
    const idx = brain.decisions.findIndex(d => (d.decision || d) === text);
    if (idx === -1) return res.status(404).json({ error: "Entry not found" });
    entry = brain.decisions.splice(idx, 1)[0];
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    const idx = brain[section].findIndex(e => entryText(e) === text);
    if (idx === -1) return res.status(404).json({ error: "Entry not found" });
    entry = brain[section].splice(idx, 1)[0];
    if (typeof entry === "string") entry = { text: entry };
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  entry.section = section;
  entry.archivedAt = new Date().toISOString();
  brain.archived.push(entry);

  saveBrain(brain);
  fireWebhooks(brain, "archive", section, text);
  broadcastEvent("archive", { section, text, action: "archive", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] archived from ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true });
});

// GET /memory/archived — list archived entries
router.get("/memory/archived", (req, res) => {
  const brain = loadBrain();
  res.json(brain.archived || []);
});

// POST /memory/unarchive — move entry back from archived to its original section
router.post("/memory/unarchive", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const brain = loadBrain();
  const idx = brain.archived.findIndex(e => entryText(e) === text);
  if (idx === -1) return res.status(404).json({ error: "Entry not found in archive" });

  const entry = brain.archived.splice(idx, 1)[0];
  const section = entry.section || "workingStyle";
  delete entry.section;
  delete entry.archivedAt;
  entry.lastTouched = new Date().toISOString();

  if (section === "decisions") {
    brain.decisions.push(entry);
  } else {
    brain[section] = brain[section] || [];
    brain[section].push(entry);
  }

  saveBrain(brain);
  fireWebhooks(brain, "add", section, text);
  broadcastEvent("unarchive", { section, text, action: "unarchive", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] unarchived to ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true, section });
});

export default router;
