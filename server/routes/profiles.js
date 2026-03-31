// routes/profiles.js — context profile CRUD

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { slugify } from "../text-utils.js";
import { broadcastEvent } from "../broadcast.js";

const router = Router();

// GET /memory/profiles
router.get("/memory/profiles", (req, res) => {
  const brain = loadBrain();
  res.json(brain.profiles || []);
});

// POST /memory/profiles
router.post("/memory/profiles", (req, res) => {
  const { name, taskType, sections, tags, project } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const now = new Date().toISOString();
  const brain = loadBrain();
  if (!brain.profiles) brain.profiles = [];

  const existingIds = new Set(brain.profiles.map(p => p.id));
  const id = slugify(name, "p", existingIds);

  const profile = {
    id,
    name,
    taskType: taskType || "",
    sections: sections || ["workingStyle", "architecture", "agentRules", "decisions"],
    tags: tags || [],
    project: project || null,
    model: req.body.model || "",
    role: req.body.role || "",
    systemPrompt: req.body.systemPrompt || "",
    constraints: req.body.constraints || [],
    createdAt: now,
    updatedAt: now,
  };

  brain.profiles.push(profile);
  saveBrain(brain);
  broadcastEvent("profile-updated", { profile, ts: now });
  res.status(201).json(profile);
});

// PATCH /memory/profiles/:id
router.patch("/memory/profiles/:id", (req, res) => {
  const brain = loadBrain();
  if (!brain.profiles) brain.profiles = [];
  const profile = brain.profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const { name, taskType, sections, tags, project } = req.body;
  if (name !== undefined) profile.name = name;
  if (taskType !== undefined) profile.taskType = taskType;
  if (sections !== undefined) profile.sections = sections;
  if (tags !== undefined) profile.tags = tags;
  if (project !== undefined) profile.project = project;
  if (req.body.model !== undefined) profile.model = req.body.model;
  if (req.body.role !== undefined) profile.role = req.body.role;
  if (req.body.systemPrompt !== undefined) profile.systemPrompt = req.body.systemPrompt;
  if (req.body.constraints !== undefined) profile.constraints = req.body.constraints;
  profile.updatedAt = new Date().toISOString();

  saveBrain(brain);
  broadcastEvent("profile-updated", { profile, ts: profile.updatedAt });
  res.json(profile);
});

// DELETE /memory/profiles/:id
router.delete("/memory/profiles/:id", (req, res) => {
  const brain = loadBrain();
  if (!brain.profiles) brain.profiles = [];
  const idx = brain.profiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Profile not found" });

  brain.profiles.splice(idx, 1);
  saveBrain(brain);
  broadcastEvent("profile-updated", { deleted: req.params.id, ts: new Date().toISOString() });
  res.json({ ok: true });
});

export default router;
