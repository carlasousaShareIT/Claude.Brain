// routes/projects.js — project CRUD, close, and reopen

import { Router } from "express";
import { getProjects, upsertProject, deleteProject, closeProject, reopenProject, getWebhooks } from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// GET /memory/projects — list project definitions
router.get("/memory/projects", (req, res) => {
  res.json(getProjects());
});

// POST /memory/projects — add or update a project definition
router.post("/memory/projects", (req, res) => {
  const { id, name, repos, status } = req.body;
  if (!id || !name) return res.status(400).json({ error: "Missing id or name" });

  upsertProject({ id, name, repos, status });
  broadcastEvent("project", { action: "upsert", project: { id, name, repos: repos || [], status: status || "active" }, ts: new Date().toISOString() });
  console.log(`[brain] project upsert: ${id} — ${name}`);
  res.json({ ok: true });
});

// DELETE /memory/projects — remove a project definition
router.delete("/memory/projects", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const deleted = deleteProject(id);
  if (!deleted) return res.status(404).json({ error: "Project not found" });

  broadcastEvent("project", { action: "delete", id, ts: new Date().toISOString() });
  console.log(`[brain] project deleted: ${id}`);
  res.json({ ok: true });
});

// POST /memory/projects/close — close a project and archive exclusive entries
router.post("/memory/projects/close", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const result = closeProject(id);
  if (!result) return res.status(404).json({ error: "Project not found" });

  const { archived, retagged } = result;
  const now = new Date().toISOString();
  broadcastEvent("project-closed", { id, archived, retagged, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "project-closed", "projects", id);
  console.log(`[brain] project closed: ${id} — ${archived} archived, ${retagged} retagged`);
  res.json({ ok: true, archived, retagged });
});

// POST /memory/projects/reopen — reopen a closed project and unarchive its entries
router.post("/memory/projects/reopen", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const result = reopenProject(id);
  if (!result) return res.status(404).json({ error: "Project not found" });

  const { unarchived } = result;
  const now = new Date().toISOString();
  broadcastEvent("project-reopened", { id, unarchived, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "project-reopened", "projects", id);
  console.log(`[brain] project reopened: ${id} — ${unarchived} unarchived`);
  res.json({ ok: true, unarchived });
});

export default router;
