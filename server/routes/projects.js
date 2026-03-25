// routes/projects.js — project CRUD, close, and reopen

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { getEntryProjects } from "../entry-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// GET /memory/projects — list project definitions
router.get("/memory/projects", (req, res) => {
  const brain = loadBrain();
  res.json(brain.projects || []);
});

// POST /memory/projects — add or update a project definition
router.post("/memory/projects", (req, res) => {
  const { id, name, repos, status } = req.body;
  if (!id || !name) return res.status(400).json({ error: "Missing id or name" });

  const brain = loadBrain();
  const idx = brain.projects.findIndex(p => p.id === id);
  const project = { id, name, repos: repos || [], status: status || "active" };
  if (idx >= 0) {
    brain.projects[idx] = project;
  } else {
    brain.projects.push(project);
  }

  saveBrain(brain);
  broadcastEvent("project", { action: "upsert", project, ts: new Date().toISOString() });
  console.log(`[brain] project upsert: ${id} — ${name}`);
  res.json({ ok: true });
});

// DELETE /memory/projects — remove a project definition
router.delete("/memory/projects", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const brain = loadBrain();
  const before = brain.projects.length;
  brain.projects = brain.projects.filter(p => p.id !== id);
  if (brain.projects.length === before) return res.status(404).json({ error: "Project not found" });

  saveBrain(brain);
  broadcastEvent("project", { action: "delete", id, ts: new Date().toISOString() });
  console.log(`[brain] project deleted: ${id}`);
  res.json({ ok: true });
});

// POST /memory/projects/close — close a project and archive exclusive entries
router.post("/memory/projects/close", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const brain = loadBrain();
  const project = brain.projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  project.status = "closed";

  // Gather closed project IDs for checking "all other projects also closed"
  const closedProjectIds = new Set(brain.projects.filter(p => p.status === "closed").map(p => p.id));

  let archived = 0;
  let retagged = 0;
  const now = new Date().toISOString();

  const processSection = (sectionName) => {
    const remaining = [];
    for (const entry of (brain[sectionName] || [])) {
      const projects = getEntryProjects(entry);
      if (!projects.includes(id)) {
        remaining.push(entry);
        continue;
      }
      // Entry is tagged with the closing project
      const otherActiveProjects = projects.filter(p => p !== id && !closedProjectIds.has(p));
      if (otherActiveProjects.length > 0) {
        // Has other active project tags — just remove the closing project
        entry.project = projects.filter(p => p !== id);
        entry.lastTouched = now;
        remaining.push(entry);
        retagged++;
      } else {
        // All project tags are closed (or this is the only one) — archive
        const archiveEntry = typeof entry === "string" ? { text: entry } : { ...entry };
        archiveEntry.section = sectionName;
        archiveEntry.archivedAt = now;
        brain.archived.push(archiveEntry);
        archived++;
      }
    }
    brain[sectionName] = remaining;
  };

  processSection("workingStyle");
  processSection("architecture");
  processSection("agentRules");

  // Process decisions separately (same logic)
  const remainingDecisions = [];
  for (const entry of (brain.decisions || [])) {
    const projects = getEntryProjects(entry);
    if (!projects.includes(id)) {
      remainingDecisions.push(entry);
      continue;
    }
    const otherActiveProjects = projects.filter(p => p !== id && !closedProjectIds.has(p));
    if (otherActiveProjects.length > 0) {
      entry.project = projects.filter(p => p !== id);
      entry.lastTouched = now;
      remainingDecisions.push(entry);
      retagged++;
    } else {
      const archiveEntry = { ...entry };
      archiveEntry.section = "decisions";
      archiveEntry.archivedAt = now;
      brain.archived.push(archiveEntry);
      archived++;
    }
  }
  brain.decisions = remainingDecisions;

  saveBrain(brain);
  broadcastEvent("project-closed", { id, archived, retagged, ts: now });
  fireWebhooks(brain, "project-closed", "projects", id);
  console.log(`[brain] project closed: ${id} — ${archived} archived, ${retagged} retagged`);
  res.json({ ok: true, archived, retagged });
});

// POST /memory/projects/reopen — reopen a closed project and unarchive its entries
router.post("/memory/projects/reopen", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const brain = loadBrain();
  const project = brain.projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  project.status = "active";

  let unarchived = 0;
  const now = new Date().toISOString();
  const remaining = [];

  for (const entry of (brain.archived || [])) {
    const projects = getEntryProjects(entry);
    if (projects.includes(id)) {
      // Unarchive this entry
      const restoreSection = entry.section || "workingStyle";
      delete entry.archivedAt;
      delete entry.section;
      entry.lastTouched = now;

      if (restoreSection === "decisions") {
        brain.decisions.push(entry);
      } else {
        brain[restoreSection] = brain[restoreSection] || [];
        brain[restoreSection].push(entry);
      }
      unarchived++;
    } else {
      remaining.push(entry);
    }
  }
  brain.archived = remaining;

  saveBrain(brain);
  broadcastEvent("project-reopened", { id, unarchived, ts: now });
  fireWebhooks(brain, "project-reopened", "projects", id);
  console.log(`[brain] project reopened: ${id} — ${unarchived} unarchived`);
  res.json({ ok: true, unarchived });
});

export default router;
