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
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_MISSION_STATUSES = new Set(["active", "completed", "abandoned"]);
const VALID_TASK_STATUSES = new Set(["pending", "in_progress", "completed", "blocked"]);

const router = Router();

// POST /missions — create a mission
router.post("/", (req, res) => {
  const { name, project, sessionId, tasks } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const mission = createMission({ name, project, sessionId, tasks });
  const now = new Date().toISOString();

  broadcastEvent("mission-created", { mission, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "mission-created", "missions", mission.name);
  console.log(`[brain] mission created: ${mission.id} — ${mission.name}`);
  res.status(201).json(mission);
});

// GET /missions/resume — resumable work for a session
// (Defined before /:id to avoid route conflict)
router.get("/resume", (req, res) => {
  const projectFilter = req.query.project || "";
  const result = getResumableMissions(projectFilter);
  res.json(result);
});

// GET /missions/agents — agent execution stats
router.get("/agents", (req, res) => {
  const result = getAgentStats();
  res.json(result);
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

  broadcastEvent("task-updated", { missionId: mission.id, added: newTasks.length, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "task-updated", "missions", `${newTasks.length} tasks added to ${mission.name}`);
  console.log(`[brain] ${newTasks.length} tasks added to mission ${mission.id}`);
  res.status(201).json(newTasks);
});

// PATCH /missions/:id/tasks/:taskId — update a task
router.patch("/:id/tasks/:taskId", (req, res) => {
  const { status, assignedAgent, sessionId, output, blockers, description } = req.body;

  if (status !== undefined && !VALID_TASK_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_TASK_STATUSES].join(", ")}` });
  }

  const { task, missionAutoCompleted } = updateTask(req.params.id, req.params.taskId, {
    status, assignedAgent, sessionId, output, blockers, description,
  });

  if (!task) {
    // Determine whether mission or task is missing
    const mission = getMission(req.params.id);
    if (!mission) return res.status(404).json({ error: "Mission not found" });
    return res.status(404).json({ error: "Task not found" });
  }

  const now = new Date().toISOString();

  if (missionAutoCompleted) {
    const mission = getMission(req.params.id);
    broadcastEvent("mission-updated", { mission, ts: now });
    fireWebhooks({ webhooks: getWebhooks() }, "mission-updated", "missions", `${mission.name} auto-completed`);
    console.log(`[brain] mission auto-completed: ${mission.id}`);
  }

  broadcastEvent("task-updated", { missionId: req.params.id, task, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "task-updated", "missions", `${task.description} → ${task.status}`);
  console.log(`[brain] task updated: ${task.id} in ${req.params.id} — status=${task.status}`);
  res.json(task);
});

export default router;
