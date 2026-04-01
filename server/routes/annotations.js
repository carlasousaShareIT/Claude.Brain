// routes/annotations.js — add, remove, and list annotations on entries

import { Router } from "express";
import { addAnnotation, removeAnnotation, getAnnotatedEntries, getWebhooks } from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /memory/annotate — add annotation to an entry
router.post("/memory/annotate", (req, res) => {
  const { section, text, note, source, sessionId } = req.body;
  if (!section || !text || !note) return res.status(400).json({ error: "Missing section, text, or note" });

  if (section !== "decisions" && !["workingStyle", "architecture", "agentRules"].includes(section)) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  const result = addAnnotation(section, text, { note, source, sessionId });
  if (!result) return res.status(404).json({ error: "Entry not found" });

  fireWebhooks({ webhooks: getWebhooks() }, "annotate", section, text);
  broadcastEvent("annotate", { section, text, action: "annotate", source: source || "unknown", ts: new Date().toISOString() });
  console.log(`[brain] annotated ${section}: "${text.slice(0, 60)}" — ${note.slice(0, 40)}`);
  res.json({ ok: true });
});

// DELETE /memory/annotate — remove annotation from an entry
router.delete("/memory/annotate", (req, res) => {
  const { section, text, note } = req.body;
  if (!section || !text || !note) return res.status(400).json({ error: "Missing section, text, or note" });

  if (section !== "decisions" && !["workingStyle", "architecture", "agentRules"].includes(section)) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  const result = removeAnnotation(section, text, note);
  if (!result) return res.status(404).json({ error: "Annotation not found" });

  console.log(`[brain] annotation removed from ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true });
});

// GET /memory/annotations — list all entries with annotations
router.get("/memory/annotations", (req, res) => {
  res.json(getAnnotatedEntries());
});

export default router;
