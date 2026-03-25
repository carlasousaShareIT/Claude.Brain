// routes/annotations.js — add, remove, and list annotations on entries

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { entryText } from "../entry-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /memory/annotate — add annotation to an entry
router.post("/memory/annotate", (req, res) => {
  const { section, text, note, source, sessionId } = req.body;
  if (!section || !text || !note) return res.status(400).json({ error: "Missing section, text, or note" });

  const brain = loadBrain();
  let found = false;

  const addAnnotation = (entry) => {
    if (!entry.annotations) entry.annotations = [];
    entry.annotations.push({ note, ts: new Date().toISOString(), source: source || "unknown", sessionId: sessionId || null });
    found = true;
  };

  if (section === "decisions") {
    for (const d of brain.decisions) {
      if ((d.decision || d) === text) { addAnnotation(d); break; }
    }
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    brain[section] = brain[section].map(e => {
      if (entryText(e) === text) {
        const obj = typeof e === "string" ? { text: e } : e;
        addAnnotation(obj);
        return obj;
      }
      return e;
    });
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  if (!found) return res.status(404).json({ error: "Entry not found" });

  saveBrain(brain);
  fireWebhooks(brain, "annotate", section, text);
  broadcastEvent("annotate", { section, text, action: "annotate", source: source || "unknown", ts: new Date().toISOString() });
  console.log(`[brain] annotated ${section}: "${text.slice(0, 60)}" — ${note.slice(0, 40)}`);
  res.json({ ok: true });
});

// DELETE /memory/annotate — remove annotation from an entry
router.delete("/memory/annotate", (req, res) => {
  const { section, text, note } = req.body;
  if (!section || !text || !note) return res.status(400).json({ error: "Missing section, text, or note" });

  const brain = loadBrain();
  let found = false;

  const removeAnnotation = (entry) => {
    if (!entry.annotations) return;
    const before = entry.annotations.length;
    entry.annotations = entry.annotations.filter(a => a.note !== note);
    if (entry.annotations.length < before) found = true;
  };

  if (section === "decisions") {
    for (const d of brain.decisions) {
      if ((d.decision || d) === text) { removeAnnotation(d); break; }
    }
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    brain[section] = brain[section].map(e => {
      if (entryText(e) === text) {
        const obj = typeof e === "string" ? { text: e } : e;
        removeAnnotation(obj);
        return obj;
      }
      return e;
    });
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  if (!found) return res.status(404).json({ error: "Annotation not found" });

  saveBrain(brain);
  console.log(`[brain] annotation removed from ${section}: "${text.slice(0, 60)}"`);
  res.json({ ok: true });
});

// GET /memory/annotations — list all entries with annotations
router.get("/memory/annotations", (req, res) => {
  const brain = loadBrain();
  const results = [];

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    for (const entry of (brain[section] || [])) {
      if (typeof entry === "object" && entry.annotations && entry.annotations.length > 0) {
        results.push({ section, text: entryText(entry), annotations: entry.annotations });
      }
    }
  }

  for (const entry of (brain.decisions || [])) {
    if (typeof entry === "object" && entry.annotations && entry.annotations.length > 0) {
      results.push({ section: "decisions", text: entryText(entry), annotations: entry.annotations });
    }
  }

  res.json(results);
});

export default router;
