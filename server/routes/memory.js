// routes/memory.js — core memory CRUD, search, context, and utility endpoints

import path from "path";
import { Router } from "express";
import {
  getFullBrain,
  addEntry, removeEntry, updateEntry, updateConfidence,
  addDecision, resolveDecision, updateDecision, updateDecisionConfidence,
  searchEntries, getSessions, getLog, clearLog, addLogEntry,
  getContextMarkdown, getTimeline,
  checkConflicts, diffEntries, retagEntry, checkHealth,
  getWebhooks,
} from "../db-store.js";
import { detectSection } from "../entry-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";
import { getDb } from "../db.js";

const router = Router();

// Helper: process a single memory operation. Returns { ok, section, action, valText } or throws.
function processMemoryOp({ section, action, value, source, sessionId, confidence, project }) {
  if (!section || !action || !value) {
    throw new Error("Missing section, action, or value");
  }

  const valText = typeof value === "string" ? value : (value.text || value.decision || value);

  addLogEntry({
    action,
    section,
    source: source || "unknown",
    sessionId: sessionId || null,
    value: valText,
  });

  if (section === "decisions") {
    const decisionText = typeof value === "object" ? (value.decision || value.text || value) : value;
    if (action === "add") {
      addDecision({
        decision: decisionText,
        status: (typeof value === "object" && value.status) || "open",
        confidence: confidence || (typeof value === "object" && value.confidence) || "tentative",
        source: source || "unknown",
        sessionId: sessionId || null,
        project,
      });
    } else if (action === "resolve") {
      resolveDecision(decisionText);
    } else if (action === "update") {
      updateDecision(decisionText, {
        decision: typeof value === "object" ? value.decision : value,
        status: typeof value === "object" ? value.status : undefined,
        confidence: confidence || (typeof value === "object" ? value.confidence : undefined),
        sessionId: sessionId || null,
        project,
      }, source);
    }
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    const text = typeof value === "string" ? value : (value.text || value.old || "");

    if (action === "add") {
      addEntry(section, text, { confidence, source, sessionId, project });
    } else if (action === "remove") {
      removeEntry(section, text);
    } else if (action === "update") {
      const oldText = typeof value === "object" ? value.old : value;
      const newText = typeof value === "object" ? value.new : value;
      updateEntry(section, oldText, newText, { source, sessionId, confidence, project });
    }
  } else {
    throw new Error(`Unknown section: ${section}`);
  }

  return { ok: true, section, action, valText };
}

// POST /memory — orchestrator sends updates here
router.post("/memory", (req, res) => {
  try {
    const result = processMemoryOp(req.body);
    fireWebhooks({ webhooks: getWebhooks() }, result.action, result.section, result.valText);
    broadcastEvent(result.action, { section: result.section, text: result.valText, action: result.action, source: req.body.source || "unknown", ts: new Date().toISOString() });
    console.log(`[brain] ${result.section}:${result.action} — ${JSON.stringify(result.valText).slice(0, 80)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /memory/batch — process multiple memory operations in a single request
router.post("/memory/batch", (req, res) => {
  const { operations } = req.body;

  if (!operations || !Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: "Missing or empty operations array" });
  }

  const results = [];
  const errors = [];
  const successOps = [];

  const batchRun = getDb().transaction((ops) => {
    for (let i = 0; i < ops.length; i++) {
      try {
        const result = processMemoryOp(ops[i]);
        results.push({ index: i, ok: true, section: result.section, action: result.action });
        successOps.push({ result, source: ops[i].source });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }
  });

  batchRun(operations);

  // Fire webhooks and broadcast SSE events for each successful operation (outside transaction)
  for (const { result, source } of successOps) {
    fireWebhooks({ webhooks: getWebhooks() }, result.action, result.section, result.valText);
    broadcastEvent(result.action, { section: result.section, text: result.valText, action: result.action, source: source || "unknown", ts: new Date().toISOString() });
    console.log(`[brain] batch ${result.section}:${result.action} — ${JSON.stringify(result.valText).slice(0, 80)}`);
  }

  res.json({ ok: true, results, errors });
});

// GET /memory — artifact polls this
router.get("/memory", (req, res) => {
  const projectId = req.query.project || "";
  res.json(getFullBrain(projectId || undefined));
});

// GET /memory/search?q=keyword — search across all sections
router.get("/memory/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.status(400).json({ error: "Missing q parameter" });

  const projectId = req.query.project || "";
  res.json(searchEntries(q, projectId || undefined));
});

// GET /memory/sessions — list unique session IDs with counts and time ranges
router.get("/memory/sessions", (req, res) => {
  res.json(getSessions());
});

// GET /memory/log — recent updates
router.get("/memory/log", (req, res) => {
  res.json(getLog());
});

// DELETE /memory/log — clear log
router.delete("/memory/log", (req, res) => {
  clearLog();
  res.json({ ok: true });
});

// POST /memory/auto — auto-categorize and add an entry
router.post("/memory/auto", (req, res) => {
  const { value, source, sessionId, project } = req.body;
  if (!value) return res.status(400).json({ error: "Missing value" });

  const section = detectSection(value);

  addLogEntry({
    action: "add",
    section,
    source: source || "unknown",
    sessionId: sessionId || null,
    value,
  });

  if (section === "decisions") {
    addDecision({
      decision: value,
      source: source || "unknown",
      sessionId: sessionId || null,
      project,
    });
  } else {
    addEntry(section, value, { source, sessionId, project });
  }

  fireWebhooks({ webhooks: getWebhooks() }, "add", section, value);
  broadcastEvent("add", { section, text: value, action: "add", source: source || "unknown", ts: new Date().toISOString() });
  console.log(`[brain] auto:${section} — ${value.slice(0, 80)}`);
  res.json({ ok: true, section });
});

// POST /memory/confidence — update confidence on an existing entry
router.post("/memory/confidence", (req, res) => {
  const { section, text, confidence } = req.body;
  if (!section || !text || !confidence) return res.status(400).json({ error: "Missing section, text, or confidence" });
  if (!["firm", "tentative"].includes(confidence)) return res.status(400).json({ error: "Confidence must be 'firm' or 'tentative'" });

  let found;
  if (section === "decisions") {
    found = updateDecisionConfidence(text, confidence);
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    found = updateConfidence(section, text, confidence);
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  if (!found) return res.status(404).json({ error: "Entry not found" });

  fireWebhooks({ webhooks: getWebhooks() }, "update", section, text);
  broadcastEvent("confidence", { section, text, action: "confidence", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] confidence:${section} "${text.slice(0, 60)}" → ${confidence}`);
  res.json({ ok: true });
});

// POST /memory/health — check brain entries for stale file references
router.post("/memory/health", (req, res) => {
  const { repoPath } = req.body;
  if (!repoPath) return res.status(400).json({ error: "Missing repoPath" });

  const resolvedPath = path.resolve(repoPath);
  if (
    resolvedPath.includes("..") ||
    resolvedPath === "/" ||
    /^[A-Za-z]:\\?$/.test(resolvedPath) ||
    resolvedPath.length < 10
  ) {
    return res.status(400).json({ error: "Invalid repoPath" });
  }

  res.json(checkHealth(repoPath));
});

// GET /memory/context — compact markdown for LLM context injection
// Supports ?project=<id> for project-scoped context
// Supports ?mission=<id> for mission-scoped context (auto-resolves project + appends mission tasks)
router.get("/memory/context", (req, res) => {
  const projectId = req.query.project || "";
  const missionId = req.query.mission || "";
  const profileId = req.query.profile || "";
  const format = req.query.format || "";

  const result = getContextMarkdown({
    projectId: projectId || undefined,
    missionId: missionId || undefined,
    profileId: profileId || undefined,
    format: format || undefined,
  });

  // Check for error objects returned by db-store
  if (result && typeof result === "object" && result.error) {
    const status = result.error === "not_found" ? 404 : 400;
    return res.status(status).setHeader("Content-Type", "text/markdown").send(result.message);
  }

  res.setHeader("Content-Type", "text/markdown");
  res.send(result);
});

// GET /memory/timeline — time-travel data
router.get("/memory/timeline", (req, res) => {
  const projectId = req.query.project || "";
  res.json(getTimeline(projectId || undefined));
});

// POST /memory/check — conflict detection
router.post("/memory/check", (req, res) => {
  const { value, section: targetSection } = req.body;
  if (!value) return res.status(400).json({ error: "Missing value" });

  res.json(checkConflicts(value, targetSection));
});

// POST /memory/diff — post-task brain diff: find entries not already in the brain
router.post("/memory/diff", (req, res) => {
  const { entries, project } = req.body;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Missing or empty entries array" });
  }

  const result = diffEntries(entries, project);
  console.log(`[brain] diff — ${entries.length} entries, ${result.missing.length} missing, ${result.matched.length} matched`);
  res.json(result);
});

// POST /memory/retag — change the project tag(s) on an existing entry
// Accepts: { section, text, project: [...] } — replace entire array
//          { section, text, addProject: "id" } — add a project tag
//          { section, text, removeProject: "id" } — remove a project tag
router.post("/memory/retag", (req, res) => {
  const { section, text, project, addProject, removeProject } = req.body;
  if (!section || !text) return res.status(400).json({ error: "Missing section or text" });
  if (!project && !addProject && !removeProject) return res.status(400).json({ error: "Missing project, addProject, or removeProject" });

  if (!["workingStyle", "architecture", "agentRules", "decisions"].includes(section)) {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  const result = retagEntry(section, text, { project, addProject, removeProject });

  if (!result.ok) {
    const status = result.error === "Entry not found" ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }

  const projLabel = project || addProject || removeProject;
  broadcastEvent("retag", { section, text, project: projLabel, action: "retag", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] retag ${section}: "${text.slice(0, 60)}" → ${JSON.stringify(projLabel)}`);
  res.json({ ok: true });
});

export default router;
