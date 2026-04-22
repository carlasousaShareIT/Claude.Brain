// routes/skills.js — skills CRUD

import { Router } from "express";
import {
  createSkill,
  getSkills,
  getSkill,
  updateSkill,
  deleteSkill,
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const router = Router();

// POST /skills — create a skill
router.post("/", (req, res) => {
  const { name, type, content, project, tags } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });
  if (!content) return res.status(400).json({ error: "Missing content" });

  const skill = createSkill({ name, type, content, project, tags });
  const ts = new Date().toISOString();

  broadcastEvent("skill-created", { skill, ts });
  fireWebhooks({ webhooks: getWebhooks() }, "skill-created", "skills", skill.name);
  console.log(`[brain] skill created: ${skill.id} — ${skill.name}`);
  res.status(201).json(skill);
});

// GET /skills — list skills
// Query: ?project=, ?type=
router.get("/", (req, res) => {
  const projectFilter = req.query.project || "";
  const typeFilter = req.query.type || "";
  const skills = getSkills(projectFilter, typeFilter);
  res.json(skills);
});

// GET /skills/:id — single skill
router.get("/:id", (req, res) => {
  const skill = getSkill(req.params.id);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json(skill);
});

// PATCH /skills/:id — update skill
router.patch("/:id", (req, res) => {
  const { name, type, content, project, tags } = req.body;

  const skill = updateSkill(req.params.id, { name, type, content, project, tags });
  if (!skill) return res.status(404).json({ error: "Skill not found" });

  const ts = new Date().toISOString();
  broadcastEvent("skill-updated", { skill, ts });
  fireWebhooks({ webhooks: getWebhooks() }, "skill-updated", "skills", skill.name);
  console.log(`[brain] skill updated: ${skill.id} — ${skill.name}`);
  res.json(skill);
});

// DELETE /skills/:id — delete skill
router.delete("/:id", (req, res) => {
  const existing = getSkill(req.params.id);
  if (!existing) return res.status(404).json({ error: "Skill not found" });

  deleteSkill(req.params.id);
  broadcastEvent("skill-deleted", { id: existing.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks({ webhooks: getWebhooks() }, "skill-deleted", "skills", existing.name);
  console.log(`[brain] skill deleted: ${existing.id} — ${existing.name}`);
  res.status(204).end();
});

export default router;
