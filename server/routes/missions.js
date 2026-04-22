// routes/missions.js — mission and task CRUD

import { Router } from "express";
import {
  createMission,
  getMissions,
  getMission,
  updateMission,
  deleteMission,
  addTasksToMission,
  updateTask,
  getResumableMissions,
  getAgentStats,
  getNextTasks,
  getMissionMetrics,
  getWebhooks,
  getTemplate,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addMissionNote,
  getMissionNotes,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_MISSION_STATUSES = new Set(["active", "completed", "abandoned"]);
const VALID_TASK_STATUSES = new Set(["pending", "in_progress", "reviewed", "completed", "blocked", "interrupted", "verification_failed"]);

const router = Router();

// POST /missions — create a mission
router.post("/", (req, res) => {
  let { name, project, sessionId, experimentId, tasks, template } = req.body;

  // If using a template, resolve it
  if (template) {
    const tmpl = getTemplate(template);
    if (!tmpl) return res.status(404).json({ error: `Template not found: ${template}` });
    if (!name) name = tmpl.name;
    if (!project && tmpl.project) project = tmpl.project;
    // Template tasks first, then any additional tasks from the body
    tasks = [...(tmpl.tasks || []), ...(tasks || [])];
  }

  if (!name) return res.status(400).json({ error: "Missing name" });

  const mission = createMission({ name, project, sessionId, experimentId, tasks });
  const now = new Date().toISOString();

  broadcastEvent("mission-created", { mission, template: template || null, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "mission-created", "missions", mission.name);
  console.log(`[brain] mission created: ${mission.id} — ${mission.name}${template ? ` (from template ${template})` : ""}`);
  res.status(201).json(mission);
});

// GET /missions/resume — resumable work for a session
// (Defined before /:id to avoid route conflict)
router.get("/resume", (req, res) => {
  const projectFilter = req.query.project || "";
  const result = getResumableMissions(projectFilter);
  res.json(result);
});

// --- Template routes ---

// POST /missions/templates — create a template
router.post("/templates", (req, res) => {
  const { name, description, project, tasks } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "Missing or empty tasks array" });
  }
  const template = createTemplate({ name, description, project, tasks });
  console.log(`[brain] template created: ${template.id} — ${template.name}`);
  res.status(201).json(template);
});

// GET /missions/templates — list templates
router.get("/templates", (req, res) => {
  const project = req.query.project || undefined;
  res.json(getTemplates(project));
});

// GET /missions/templates/:id — single template
router.get("/templates/:id", (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

// PATCH /missions/templates/:id — update template
router.patch("/templates/:id", (req, res) => {
  const result = updateTemplate(req.params.id, req.body);
  if (!result) return res.status(404).json({ error: "Template not found" });
  console.log(`[brain] template updated: ${result.id}`);
  res.json(result);
});

// DELETE /missions/templates/:id — delete template
router.delete("/templates/:id", (req, res) => {
  const deleted = deleteTemplate(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Template not found" });
  console.log(`[brain] template deleted: ${req.params.id}`);
  res.json({ ok: true });
});

// GET /missions/agents — agent execution stats
router.get("/agents", (req, res) => {
  const result = getAgentStats();
  res.json(result);
});

// GET /missions/:id/metrics — derived stats for a mission
router.get("/:id/metrics", (req, res) => {
  const metrics = getMissionMetrics(req.params.id);
  if (!metrics) return res.status(404).json({ error: "Mission not found" });
  res.json(metrics);
});

// GET /missions/:id/next — tasks ready to work on (no unresolved dependencies)
router.get("/:id/next", (req, res) => {
  const mission = getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });
  const next = getNextTasks(req.params.id);
  res.json(next);
});

// GET /missions — list missions
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "";
  const projectFilter = req.query.project || "";
  const summary = getMissions(statusFilter, projectFilter);
  res.json(summary);
});

// GET /missions/:id — single mission with full task details
router.get("/:id", (req, res) => {
  const mission = getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });
  res.json(mission);
});

// PATCH /missions/:id — update mission
router.patch("/:id", (req, res) => {
  const { name, status, project } = req.body;

  if (status !== undefined && !VALID_MISSION_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_MISSION_STATUSES].join(", ")}` });
  }

  const mission = updateMission(req.params.id, { name, status, project });
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const now = new Date().toISOString();
  broadcastEvent("mission-updated", { mission, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "mission-updated", "missions", mission.name);
  console.log(`[brain] mission updated: ${mission.id} — status=${mission.status}`);
  res.json(mission);
});

// DELETE /missions/:id — delete a mission entirely
router.delete("/:id", (req, res) => {
  const existing = getMission(req.params.id);
  if (!existing) return res.status(404).json({ error: "Mission not found" });

  deleteMission(req.params.id);
  broadcastEvent("mission-updated", { id: existing.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks({ webhooks: getWebhooks() }, "mission-deleted", "missions", existing.name);
  console.log(`[brain] mission deleted: ${existing.id} — ${existing.name}`);
  res.json({ ok: true });
});

// POST /missions/:id/tasks — add tasks to an existing mission
router.post("/:id/tasks", (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "Missing or empty tasks array" });
  }

  const mission = getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const newTasks = addTasksToMission(req.params.id, tasks);
  const now = new Date().toISOString();

  broadcastEvent("task-updated", { missionId: mission.id, missionName: mission.name, added: newTasks.length, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "task-updated", "missions", `${newTasks.length} tasks added to ${mission.name}`);
  console.log(`[brain] ${newTasks.length} tasks added to mission ${mission.id}`);
  res.status(201).json(newTasks);
});

// PATCH /missions/:id/tasks/:taskId — update a task
router.patch("/:id/tasks/:taskId", (req, res) => {
  const { status, assignedAgent, sessionId, output, blockers, blockedBy, description, title, phase, verificationCommand, verificationResult } = req.body;

  if (status !== undefined && !VALID_TASK_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_TASK_STATUSES].join(", ")}` });
  }

  const result = updateTask(req.params.id, req.params.taskId, {
    status, assignedAgent, sessionId, output, blockers, blockedBy, description, title, phase, verificationCommand, verificationResult,
  });

  // Quality gate: verification required but not provided
  if (result.verificationRequired) {
    return res.status(422).json({ error: "Task has a verificationCommand — verificationResult is required when completing" });
  }

  // Quality gate: review required before completing
  if (result.reviewRequired) {
    return res.status(400).json({ error: "Task must be reviewed first, or provide verificationResult with exitCode 0. Set status to 'reviewed' before completing." });
  }

  const { task, missionAutoCompleted, unblockedTasks, autoObservations } = result;

  if (!task) {
    // Determine whether mission or task is missing
    const mission = getMission(req.params.id);
    if (!mission) return res.status(404).json({ error: "Mission not found" });
    return res.status(404).json({ error: "Task not found" });
  }

  const now = new Date().toISOString();

  // Look up mission name once for all task-updated broadcasts.
  const missionForBroadcast = getMission(req.params.id);
  const missionName = missionForBroadcast ? missionForBroadcast.name : req.params.id;

  if (missionAutoCompleted) {
    broadcastEvent("mission-updated", { mission: missionForBroadcast, ts: now });
    fireWebhooks({ webhooks: getWebhooks() }, "mission-updated", "missions", `${missionName} auto-completed`);
    console.log(`[brain] mission auto-completed: ${missionForBroadcast.id}`);

    // Log auto-observations generated for experiments
    for (const obs of (autoObservations || [])) {
      broadcastEvent("observation-added", { experimentId: obs.experimentId, observation: obs, ts: now });
      console.log(`[brain] auto-observation for experiment ${obs.experimentName}: ${obs.sentiment}`);
    }
  }

  // Broadcast events for auto-unblocked tasks
  for (const unblocked of unblockedTasks) {
    broadcastEvent("task-updated", { missionId: req.params.id, missionName, task: unblocked, ts: now });
    console.log(`[brain] task auto-unblocked: ${unblocked.id} in ${req.params.id}`);
  }

  broadcastEvent("task-updated", { missionId: req.params.id, missionName, task, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "task-updated", "missions", `${task.description} → ${task.status}`);
  console.log(`[brain] task updated: ${task.id} in ${req.params.id} — status=${task.status}`);
  res.json({ ...task, unblockedTasks });
});

// PATCH /missions/:id/tasks/:taskId/retry — retry a verification_failed task
router.patch("/:id/tasks/:taskId/retry", (req, res) => {
  const mission = getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const task = mission.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found" });

  if (task.status !== "verification_failed") {
    return res.status(400).json({ error: `Can only retry verification_failed tasks. Current status: "${task.status}"` });
  }

  const { task: updatedTask } = updateTask(req.params.id, req.params.taskId, {
    status: "in_progress",
    verificationResult: null,
    output: null,
  });

  if (!updatedTask) return res.status(500).json({ error: "Failed to update task" });

  const now = new Date().toISOString();
  broadcastEvent("task-updated", { missionId: req.params.id, missionName: mission.name, task: updatedTask, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "task-updated", "missions", `${updatedTask.description} → retry`);
  console.log(`[brain] task retried: ${updatedTask.id} in ${req.params.id}`);
  res.json(updatedTask);
});

// POST /missions/:id/notes — add a note to a mission
router.post("/:id/notes", (req, res) => {
  const { text, sessionId } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const note = addMissionNote(req.params.id, { text, sessionId });
  if (!note) return res.status(404).json({ error: "Mission not found" });

  console.log(`[brain] note added to mission ${req.params.id}: ${note.id}`);
  res.status(201).json(note);
});

// GET /missions/:id/notes — list notes for a mission
router.get("/:id/notes", (req, res) => {
  const mission = getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });
  res.json(getMissionNotes(req.params.id));
});

export default router;
