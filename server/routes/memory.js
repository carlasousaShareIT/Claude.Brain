// routes/memory.js — core memory CRUD, search, context, and utility endpoints

import fs from "fs";
import path from "path";
import os from "os";
import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { toEntry, entryText, normalizeProject, getEntryProjects, filterByProject, detectSection } from "../entry-utils.js";
import { tokenize, similarity } from "../text-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /memory — orchestrator sends updates here
router.post("/memory", (req, res) => {
  const { section, action, value, source, sessionId, confidence, project } = req.body;

  if (!section || !action || !value) {
    return res.status(400).json({ error: "Missing section, action, or value" });
  }

  const brain = loadBrain();

  brain.log = brain.log || [];
  brain.log.unshift({
    ts: new Date().toISOString(),
    source: source || "unknown",
    sessionId: sessionId || null,
    section, action, value: typeof value === "object" ? (value.text || value.decision || value) : value,
  });
  if (brain.log.length > 500) brain.log = brain.log.slice(0, 500);

  if (section === "decisions") {
    const entry = toEntry(value, "decisions", sessionId, source, confidence, project);

    if (action === "add") {
      const exists = brain.decisions.some(d => (d.decision || d) === entry.decision);
      if (!exists) brain.decisions.push(entry);
    } else if (action === "resolve") {
      brain.decisions = brain.decisions.map(d =>
        (d.decision || d) === entry.decision ? { ...d, status: "resolved", lastTouched: new Date().toISOString() } : d
      );
    } else if (action === "update") {
      brain.decisions = brain.decisions.map(d => {
        if ((d.decision || d) === entry.decision) {
          const oldEntry = { ...d };
          const updated = { ...d, ...entry, lastTouched: new Date().toISOString() };
          if (!updated.history) updated.history = [];
          updated.history.push({ text: oldEntry.decision || entryText(oldEntry), changedAt: new Date().toISOString(), changedBy: source || "unknown" });
          return updated;
        }
        return d;
      });
    }
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    const valText = typeof value === "string" ? value : (value.text || value.old || "");

    if (action === "add") {
      const exists = brain[section].some(e => entryText(e) === valText);
      if (!exists) brain[section].push(toEntry(valText, section, sessionId, source, confidence, project));
    } else if (action === "remove") {
      brain[section] = brain[section].filter(e => entryText(e) !== valText);
    } else if (action === "update") {
      const oldText = typeof value === "object" ? value.old : value;
      const newText = typeof value === "object" ? value.new : value;
      brain[section] = brain[section].map(e => {
        if (entryText(e) === oldText) {
          const oldEntry = typeof e === "object" ? { ...e } : { text: e };
          const updated = { ...toEntry(newText, section, sessionId, source, confidence, project), createdAt: (typeof e === "object" ? e.createdAt : undefined) || new Date().toISOString() };
          if (!updated.history) updated.history = [];
          updated.history.push({ text: entryText(oldEntry), changedAt: new Date().toISOString(), changedBy: source || "unknown" });
          // Preserve existing history from the old entry
          if (oldEntry.history) updated.history = [...oldEntry.history, ...updated.history];
          return updated;
        }
        return e;
      });
    }
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  saveBrain(brain);
  const valText = typeof value === "string" ? value : (value.text || value.decision || value);
  fireWebhooks(brain, action, section, valText);
  broadcastEvent(action, { section, text: valText, action, source: source || "unknown", ts: new Date().toISOString() });
  console.log(`[brain] ${section}:${action} — ${JSON.stringify(valText).slice(0, 80)}`);
  res.json({ ok: true });
});

// GET /memory — artifact polls this
router.get("/memory", (req, res) => {
  const brain = loadBrain();
  const projectId = req.query.project || "";
  res.json(projectId ? filterByProject(brain, projectId) : brain);
});

// GET /memory/search?q=keyword — search across all sections
router.get("/memory/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.status(400).json({ error: "Missing q parameter" });

  const terms = q.split(/\s+/);
  const projectId = req.query.project || "";
  const brain = loadBrain();
  const results = [];

  const matchesProject = (entry) => {
    if (!projectId) return true;
    return getEntryProjects(entry).includes(projectId);
  };

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    for (const entry of (brain[section] || [])) {
      if (!matchesProject(entry)) continue;
      const text = entryText(entry).toLowerCase();
      if (terms.every(t => text.includes(t))) {
        results.push({ section, entry: typeof entry === "string" ? { text: entry } : entry });
      }
    }
  }

  for (const entry of (brain.decisions || [])) {
    if (!matchesProject(entry)) continue;
    const text = (entry.decision || "").toLowerCase();
    if (terms.every(t => text.includes(t))) {
      results.push({ section: "decisions", entry });
    }
  }

  for (const exp of (brain.experiments || [])) {
    if (projectId && !(exp.project || []).includes(projectId)) continue;
    const searchable = `${exp.name} ${exp.hypothesis} ${(exp.observations || []).map(o => o.text).join(" ")}`.toLowerCase();
    if (terms.every(t => searchable.includes(t))) {
      results.push({ section: "experiments", entry: exp });
    }
  }

  res.json({ query: q, count: results.length, results });
});

// GET /memory/sessions — list unique session IDs with counts and time ranges
router.get("/memory/sessions", (req, res) => {
  const brain = loadBrain();
  const sessions = {};

  const track = (sessionId, createdAt, section, entryProjects) => {
    if (!sessionId) return;
    if (!sessions[sessionId]) sessions[sessionId] = { id: sessionId, count: 0, sections: {}, projects: new Set(), earliest: createdAt, latest: createdAt };
    const s = sessions[sessionId];
    s.count++;
    s.sections[section] = (s.sections[section] || 0) + 1;
    if (createdAt && createdAt < s.earliest) s.earliest = createdAt;
    if (createdAt && createdAt > s.latest) s.latest = createdAt;
    if (entryProjects) entryProjects.forEach(p => s.projects.add(p));
  };

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    for (const entry of (brain[section] || [])) {
      if (typeof entry === "object") track(entry.sessionId, entry.createdAt, section, entry.project);
    }
  }
  for (const entry of (brain.decisions || [])) {
    if (typeof entry === "object") track(entry.sessionId, entry.createdAt, "decisions", entry.project);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const result = Object.values(sessions).map(s => {
    let label = null;
    if (uuidPattern.test(s.id)) {
      try {
        label = fs.readFileSync(path.join(os.homedir(), ".claude", "sessions", s.id + ".label"), "utf8").trim();
      } catch { /* no label file */ }
    }
    return { ...s, label, projects: [...s.projects] };
  });
  res.json(result.sort((a, b) => (b.latest || "").localeCompare(a.latest || "")));
});

// GET /memory/log — recent updates
router.get("/memory/log", (req, res) => {
  const brain = loadBrain();
  res.json(brain.log || []);
});

// DELETE /memory/log — clear log
router.delete("/memory/log", (req, res) => {
  const brain = loadBrain();
  brain.log = [];
  saveBrain(brain);
  res.json({ ok: true });
});

// POST /memory/auto — auto-categorize and add an entry
router.post("/memory/auto", (req, res) => {
  const { value, source, sessionId, project } = req.body;
  if (!value) return res.status(400).json({ error: "Missing value" });

  const section = detectSection(value);

  const brain = loadBrain();

  brain.log = brain.log || [];
  brain.log.unshift({
    ts: new Date().toISOString(),
    source: source || "unknown",
    sessionId: sessionId || null,
    section, action: "add", value,
  });
  if (brain.log.length > 500) brain.log = brain.log.slice(0, 500);

  if (section === "decisions") {
    const entry = toEntry(value, "decisions", sessionId, source, undefined, project);
    const exists = brain.decisions.some(d => (d.decision || d) === entry.decision);
    if (!exists) brain.decisions.push(entry);
  } else {
    const exists = brain[section].some(e => entryText(e) === value);
    if (!exists) brain[section].push(toEntry(value, section, sessionId, source, undefined, project));
  }

  saveBrain(brain);
  fireWebhooks(brain, "add", section, value);
  broadcastEvent("add", { section, text: value, action: "add", source: source || "unknown", ts: new Date().toISOString() });
  console.log(`[brain] auto:${section} — ${value.slice(0, 80)}`);
  res.json({ ok: true, section });
});

// POST /memory/confidence — update confidence on an existing entry
router.post("/memory/confidence", (req, res) => {
  const { section, text, confidence } = req.body;
  if (!section || !text || !confidence) return res.status(400).json({ error: "Missing section, text, or confidence" });
  if (!["firm", "tentative"].includes(confidence)) return res.status(400).json({ error: "Confidence must be 'firm' or 'tentative'" });

  const brain = loadBrain();

  if (section === "decisions") {
    let found = false;
    brain.decisions = brain.decisions.map(d => {
      if ((d.decision || d) === text) { found = true; return { ...d, confidence, lastTouched: new Date().toISOString() }; }
      return d;
    });
    if (!found) return res.status(404).json({ error: "Entry not found" });
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    let found = false;
    brain[section] = brain[section].map(e => {
      if (entryText(e) === text) { found = true; return { ...(typeof e === "string" ? { text: e } : e), confidence, lastTouched: new Date().toISOString() }; }
      return e;
    });
    if (!found) return res.status(404).json({ error: "Entry not found" });
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  saveBrain(brain);
  fireWebhooks(brain, "update", section, text);
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

  const brain = loadBrain();
  const pathRegex = /(?:^|\s|['"`])((?:src|components|hooks|server|routes|lib|services|modules|app|pages|utils|assets|styles|models|shared|features|core|config|public)\/[\w\/\-\.]+\.\w+)/gi;

  const staleEntries = [];
  const healthyEntries = [];
  let checkedEntries = 0;
  let noReferencesEntries = 0;

  const checkSection = (entries, section) => {
    for (const entry of entries) {
      const text = entryText(entry);
      const matches = [...text.matchAll(pathRegex)];
      if (matches.length === 0) {
        noReferencesEntries++;
        continue;
      }
      checkedEntries++;
      const references = matches.map(m => {
        const p = m[1];
        const fullPath = path.join(repoPath, p);
        return { path: p, exists: fs.existsSync(fullPath) };
      });
      const hasStale = references.some(r => !r.exists);
      (hasStale ? staleEntries : healthyEntries).push({ section, text, references });
    }
  };

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    checkSection(brain[section] || [], section);
  }
  checkSection((brain.decisions || []).map(d => ({ ...d, text: d.decision || entryText(d) })), "decisions");

  res.json({ checkedEntries, staleEntries, healthyEntries, noReferencesEntries });
});

// GET /memory/context — compact markdown for LLM context injection
// Supports ?project=<id> for project-scoped context
// Supports ?mission=<id> for mission-scoped context (auto-resolves project + appends mission tasks)
router.get("/memory/context", (req, res) => {
  const missionId = req.query.mission || "";
  const rawBrain = loadBrain();

  // If mission is specified, resolve its project automatically
  let projectId = req.query.project || "";
  let mission = null;
  if (missionId) {
    mission = (rawBrain.missions || []).find(m => m.id === missionId);
    if (!mission) {
      return res.status(404).setHeader("Content-Type", "text/markdown").send(`Mission not found: ${missionId}`);
    }
    if (!projectId && mission.project) {
      projectId = mission.project;
    }
  }

  // Profile-based filtering
  const profileId = req.query.profile || "";
  let profileFilter = null;
  if (profileId) {
    profileFilter = (rawBrain.profiles || []).find(p => p.id === profileId);
    if (!profileFilter) {
      return res.status(404).setHeader("Content-Type", "text/markdown").send(`Profile not found: ${profileId}`);
    }
    // Profile's project takes precedence if set
    if (profileFilter.project && !projectId) {
      projectId = profileFilter.project;
    }
  }

  const brain = projectId ? filterByProject(rawBrain, projectId) : rawBrain;
  const lines = [];
  if (mission) {
    const proj = projectId ? (rawBrain.projects || []).find(p => p.id === projectId) : null;
    lines.push(`# Brain Context — Mission: ${mission.name}${proj ? ` (${proj.name})` : ""}`);
    lines.push("");
  } else if (profileFilter) {
    lines.push(`# Brain Context — Profile: ${profileFilter.name}`);
    lines.push("");
    // Persona block
    if (profileFilter.model || profileFilter.role || profileFilter.systemPrompt || (profileFilter.constraints && profileFilter.constraints.length)) {
      lines.push("## Agent Persona");
      if (profileFilter.model) lines.push(`- **Model:** ${profileFilter.model}`);
      if (profileFilter.role) lines.push(`- **Role:** ${profileFilter.role}`);
      if (profileFilter.systemPrompt) {
        lines.push(`- **System prompt:**`);
        lines.push(profileFilter.systemPrompt);
      }
      if (profileFilter.constraints && profileFilter.constraints.length) {
        lines.push(`- **Constraints:**`);
        profileFilter.constraints.forEach(c => lines.push(`  - ${c}`));
      }
      lines.push("");
    }
  } else if (projectId) {
    const proj = (rawBrain.projects || []).find(p => p.id === projectId);
    lines.push(`# Brain Context — ${proj ? proj.name : projectId}`);
    lines.push("");
  }

  const sortByConfidence = (entries) => {
    return [...entries].sort((a, b) => {
      const ca = (typeof a === "object" && a.confidence === "firm") ? 0 : 1;
      const cb = (typeof b === "object" && b.confidence === "firm") ? 0 : 1;
      return ca - cb;
    });
  };

  const formatEntry = (e) => {
    const text = entryText(e);
    const conf = (typeof e === "object" && e.confidence) ? ` [${e.confidence}]` : "";
    return `- ${text}${conf}`;
  };

  // Collect archived texts to skip
  const archivedTexts = new Set((brain.archived || []).map(e => entryText(e)));

  // Collect closed project IDs
  const closedProjectIds = new Set((rawBrain.projects || []).filter(p => p.status === "closed").map(p => p.id));

  const filterActive = (entries) => entries.filter(e => {
    if (archivedTexts.has(entryText(e))) return false;
    // Skip entries that belong ONLY to closed projects
    const projects = getEntryProjects(e);
    const hasActiveProject = projects.some(p => !closedProjectIds.has(p));
    return hasActiveProject;
  });

  const filterByProfile = (entries) => {
    if (!profileFilter || !profileFilter.tags || profileFilter.tags.length === 0) return entries;
    return entries.filter(e => {
      const text = entryText(e).toLowerCase();
      return profileFilter.tags.some(tag => text.includes(tag.toLowerCase()));
    });
  };

  if ((brain.workingStyle || []).length && (!profileFilter || profileFilter.sections.includes("workingStyle"))) {
    const active = sortByConfidence(filterByProfile(filterActive(brain.workingStyle)));
    if (active.length) {
      lines.push("## Working Style");
      active.forEach(e => lines.push(formatEntry(e)));
      lines.push("");
    }
  }

  if ((brain.architecture || []).length && (!profileFilter || profileFilter.sections.includes("architecture"))) {
    const active = sortByConfidence(filterByProfile(filterActive(brain.architecture)));
    if (active.length) {
      lines.push("## Architecture");
      active.forEach(e => lines.push(formatEntry(e)));
      lines.push("");
    }
  }

  if ((brain.agentRules || []).length && (!profileFilter || profileFilter.sections.includes("agentRules"))) {
    const active = sortByConfidence(filterByProfile(filterActive(brain.agentRules)));
    if (active.length) {
      lines.push("## Agent Rules");
      active.forEach(e => lines.push(formatEntry(e)));
      lines.push("");
    }
  }

  const activeDecisions = (!profileFilter || profileFilter.sections.includes("decisions"))
    ? filterByProfile(filterActive(brain.decisions || []))
    : [];
  const openDecisions = activeDecisions.filter(d => d.status !== "resolved");
  const resolvedDecisions = activeDecisions.filter(d => d.status === "resolved");

  if (openDecisions.length) {
    lines.push("## Open Decisions");
    sortByConfidence(openDecisions).forEach(d => lines.push(`- \u25CB ${d.decision || entryText(d)}`));
    lines.push("");
  }

  if (resolvedDecisions.length) {
    lines.push("## Resolved Decisions");
    sortByConfidence(resolvedDecisions).forEach(d => lines.push(`- \u2713 ${d.decision || entryText(d)}`));
    lines.push("");
  }

  // Reminders section — pending only, project-scoped if applicable
  if (!profileFilter || profileFilter.sections.includes("reminders")) {
    const now = new Date().toISOString();
    let pendingReminders = (rawBrain.reminders || []).filter(r => {
      const isPending = r.status === "pending";
      const isExpiredSnooze = r.status === "snoozed" && r.snoozedUntil && r.snoozedUntil <= now;
      if (!isPending && !isExpiredSnooze) return false;
      if (projectId && !(r.project || []).includes(projectId)) return false;
      return true;
    });
    if (pendingReminders.length) {
      lines.push("## Reminders");
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      pendingReminders = [...pendingReminders].sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 1;
        const pb = priorityOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
      for (const r of pendingReminders) {
        const priorityTag = r.priority !== "normal" ? `[${r.priority}] ` : "";
        const dueTag = r.dueDate ? ` (due: ${r.dueDate.slice(0, 10)})` : "";
        lines.push(`- ${priorityTag}${r.text}${dueTag}`);
      }
      lines.push("");
    }
  }

  // Append active experiments
  const allExperiments = rawBrain.experiments || [];
  const activeExperiments = allExperiments.filter(e => {
    if (e.status !== "active") return false;
    if (projectId && !(e.project || []).includes(projectId)) return false;
    return true;
  });
  const concludedExperiments = allExperiments.filter(e => {
    if (e.status !== "concluded") return false;
    if (projectId && !(e.project || []).includes(projectId)) return false;
    return true;
  });

  if (activeExperiments.length) {
    lines.push("## Active Experiments");
    for (const exp of activeExperiments) {
      lines.push(`- **${exp.name}** (\`${exp.id}\`)`);
      lines.push(`  Hypothesis: ${exp.hypothesis}`);
      const obs = exp.observations || [];
      if (obs.length) {
        const pos = obs.filter(o => o.sentiment === "positive").length;
        const neg = obs.filter(o => o.sentiment === "negative").length;
        const neu = obs.filter(o => o.sentiment === "neutral").length;
        lines.push(`  Observations: ${obs.length} (${pos} positive, ${neg} negative, ${neu} neutral)`);
        const recent = obs.slice(-2);
        for (const o of recent) {
          const icon = o.sentiment === "positive" ? "+" : o.sentiment === "negative" ? "-" : "~";
          lines.push(`  [${icon}] ${o.text}`);
        }
      } else {
        lines.push(`  No observations yet.`);
      }
    }
    lines.push("");
  }

  if (concludedExperiments.length) {
    lines.push("## Concluded Experiments");
    for (const exp of concludedExperiments) {
      const obs = exp.observations || [];
      lines.push(`- **${exp.name}** — ${exp.conclusion || "no verdict"} (${obs.length} observations)`);
    }
    lines.push("");
  }

  // Append mission tasks when mission-scoped
  if (mission) {
    const statusIcon = { pending: "○", in_progress: "▶", completed: "✓", blocked: "✗" };
    lines.push(`## Active Mission: ${mission.name}`);
    lines.push(`- **ID:** ${mission.id}`);
    lines.push(`- **Status:** ${mission.status}`);
    if (mission.createdAt) lines.push(`- **Created:** ${mission.createdAt}`);
    lines.push("");
    lines.push("### Tasks");
    for (const t of (mission.tasks || [])) {
      const icon = statusIcon[t.status] || "?";
      let line = `- ${icon} \`${t.id}\` ${t.description}`;
      if (t.assignedAgent) line += ` (agent: ${t.assignedAgent})`;
      if (t.output) line += ` — ${t.output}`;
      if (t.blockers && t.blockers.length) line += ` [blocked: ${t.blockers.join(", ")}]`;
      lines.push(line);
    }
    lines.push("");
  }

  res.setHeader("Content-Type", "text/markdown");
  res.send(lines.join("\n"));
});

// GET /memory/timeline — time-travel data
router.get("/memory/timeline", (req, res) => {
  const projectId = req.query.project || "";
  const rawBrain = loadBrain();
  const brain = projectId ? filterByProject(rawBrain, projectId) : rawBrain;
  const entries = [];

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    for (const entry of (brain[section] || [])) {
      const obj = typeof entry === "string" ? { text: entry } : entry;
      entries.push({
        text: entryText(entry),
        section,
        createdAt: obj.createdAt || null,
        archivedAt: null,
        removedAt: null,
      });
    }
  }

  for (const entry of (brain.decisions || [])) {
    const obj = typeof entry === "string" ? { decision: entry } : entry;
    entries.push({
      text: entryText(entry),
      section: "decisions",
      createdAt: obj.createdAt || null,
      archivedAt: null,
      removedAt: null,
    });
  }

  for (const entry of (brain.archived || [])) {
    const obj = typeof entry === "string" ? { text: entry } : entry;
    entries.push({
      text: entryText(entry),
      section: obj.section || "unknown",
      createdAt: obj.createdAt || null,
      archivedAt: obj.archivedAt || null,
      removedAt: null,
    });
  }

  entries.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const dates = entries.map(e => e.createdAt).filter(Boolean);
  res.json({
    earliest: dates[0] || null,
    latest: dates[dates.length - 1] || null,
    entries,
  });
});

// POST /memory/check — conflict detection
router.post("/memory/check", (req, res) => {
  const { value, section: targetSection } = req.body;
  if (!value) return res.status(400).json({ error: "Missing value" });

  const inputTokens = tokenize(value);
  if (inputTokens.length === 0) return res.json({ conflicts: [] });

  const inputLower = value.toLowerCase();
  const oppositionPairs = [
    ["always", "never"],
    ["must", "must not"],
    ["do", "don't"],
  ];

  const conflicts = [];
  const brain = loadBrain();

  const sections = targetSection
    ? [targetSection]
    : ["workingStyle", "architecture", "agentRules", "decisions"];

  for (const section of sections) {
    const list = brain[section] || [];
    for (const entry of list) {
      const text = entryText(entry);
      const entryTokens = tokenize(text);
      const overlap = inputTokens.filter(t => entryTokens.includes(t));
      if (overlap.length === 0) continue;

      const entryLower = text.toLowerCase();
      let reason = null;

      for (const [a, b] of oppositionPairs) {
        if (inputLower.includes(a) && entryLower.includes(b)) {
          reason = `opposing: ${a} vs ${b}`;
          break;
        }
        if (inputLower.includes(b) && entryLower.includes(a)) {
          reason = `opposing: ${b} vs ${a}`;
          break;
        }
      }

      if (reason) {
        conflicts.push({ section, text, reason, overlap });
      }
    }
  }

  res.json({ conflicts });
});

// POST /memory/diff — post-task brain diff: find entries not already in the brain
router.post("/memory/diff", (req, res) => {
  const { entries, project } = req.body;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Missing or empty entries array" });
  }

  const MATCH_THRESHOLD = 0.4;
  const brain = loadBrain();
  const filteredBrain = project ? filterByProject(brain, project) : brain;

  const missing = [];
  const matched = [];

  for (const incoming of entries) {
    const text = incoming.text || "";
    const section = incoming.section || null;
    const incomingTokens = tokenize(text);

    if (incomingTokens.length === 0) {
      missing.push({ text, suggestedSection: section || detectSection(text) });
      continue;
    }

    let bestMatch = null;
    let bestSim = 0;
    let bestSection = null;
    let bestText = "";

    // Determine which sections to search
    const sectionsToSearch = section
      ? [section]
      : ["workingStyle", "architecture", "agentRules"];

    // Search list sections
    for (const sec of sectionsToSearch) {
      if (sec === "decisions") continue; // handled separately below
      for (const entry of (filteredBrain[sec] || [])) {
        const eText = entryText(entry);
        const eTokens = tokenize(eText);
        const sim = similarity(incomingTokens, eTokens);
        if (sim > bestSim) {
          bestSim = sim;
          bestText = eText;
          bestSection = sec;
        }
      }
    }

    // Always check decisions (spec: "Also check decisions")
    for (const d of (filteredBrain.decisions || [])) {
      const dText = d.decision || entryText(d);
      const dTokens = tokenize(dText);
      const sim = similarity(incomingTokens, dTokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestText = dText;
        bestSection = "decisions";
      }
    }

    if (bestSim >= MATCH_THRESHOLD) {
      matched.push({ text, matchedWith: bestText, section: bestSection, similarity: Math.round(bestSim * 100) / 100 });
    } else {
      missing.push({ text, suggestedSection: section || detectSection(text) });
    }
  }

  console.log(`[brain] diff — ${entries.length} entries, ${missing.length} missing, ${matched.length} matched`);
  res.json({ missing, matched });
});

// POST /memory/retag — change the project tag(s) on an existing entry
// Accepts: { section, text, project: [...] } — replace entire array
//          { section, text, addProject: "id" } — add a project tag
//          { section, text, removeProject: "id" } — remove a project tag
router.post("/memory/retag", (req, res) => {
  const { section, text, project, addProject, removeProject } = req.body;
  if (!section || !text) return res.status(400).json({ error: "Missing section or text" });
  if (!project && !addProject && !removeProject) return res.status(400).json({ error: "Missing project, addProject, or removeProject" });

  const brain = loadBrain();
  let found = false;

  const updateProjectField = (entry) => {
    const current = getEntryProjects(entry);
    if (addProject) {
      if (!current.includes(addProject)) current.push(addProject);
      return current;
    }
    if (removeProject) {
      if (current.length <= 1) return null; // reject — can't remove the last tag
      return current.filter(p => p !== removeProject);
    }
    // Replace entire array
    return normalizeProject(project);
  };

  if (section === "decisions") {
    brain.decisions = brain.decisions.map(d => {
      if ((d.decision || d) === text) {
        found = true;
        const newProj = updateProjectField(d);
        if (newProj === null) return d; // will be caught below
        return { ...d, project: newProj, lastTouched: new Date().toISOString() };
      }
      return d;
    });
  } else if (["workingStyle", "architecture", "agentRules"].includes(section)) {
    brain[section] = brain[section].map(e => {
      if (entryText(e) === text) {
        found = true;
        const obj = typeof e === "string" ? { text: e } : e;
        const newProj = updateProjectField(obj);
        if (newProj === null) return obj; // will be caught below
        return { ...obj, project: newProj, lastTouched: new Date().toISOString() };
      }
      return e;
    });
  } else {
    return res.status(400).json({ error: `Unknown section: ${section}` });
  }

  if (!found) return res.status(404).json({ error: "Entry not found" });

  // Check if removeProject was rejected (last tag)
  if (removeProject) {
    // Re-check: find the entry and see if it still has removeProject
    const findEntry = (list) => list.find(e => entryText(e) === text);
    const entry = section === "decisions" ? findEntry(brain.decisions) : findEntry(brain[section] || []);
    if (entry && getEntryProjects(entry).length <= 1 && getEntryProjects(entry).includes(removeProject)) {
      return res.status(400).json({ error: "Cannot remove the last project tag from an entry" });
    }
  }

  saveBrain(brain);
  const projLabel = project || addProject || removeProject;
  broadcastEvent("retag", { section, text, project: projLabel, action: "retag", source: "user", ts: new Date().toISOString() });
  console.log(`[brain] retag ${section}: "${text.slice(0, 60)}" → ${JSON.stringify(projLabel)}`);
  res.json({ ok: true });
});

export default router;
