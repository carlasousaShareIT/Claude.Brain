// routes/missions.js — mission and task CRUD

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { slugify } from "../text-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_MISSION_STATUSES = new Set(["active", "completed", "abandoned"]);
const VALID_TASK_STATUSES = new Set(["pending", "in_progress", "completed", "blocked"]);

const router = Router();

// POST /missions — create a mission
router.post("/", (req, res) => {
  const { name, project, sessionId, tasks } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const now = new Date().toISOString();
  const brain = loadBrain();
  const existingMissionIds = new Set((brain.missions || []).map(m => m.id));
  const missionId = slugify(name, "m", existingMissionIds);

  // Collect task IDs across all missions for global uniqueness
  const existingTaskIds = new Set();
  for (const m of (brain.missions || [])) {
    for (const t of (m.tasks || [])) existingTaskIds.add(t.id);
  }

  const missionTasks = (tasks || []).map(t => {
    const taskId = slugify(t.description, "t", existingTaskIds);
    existingTaskIds.add(taskId);
    return {
      id: taskId,
      description: t.description,
      status: "pending",
      assignedAgent: null,
      sessionId: null,
      output: null,
      blockers: [],
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };
  });

  const mission = {
    id: missionId,
    name,
    project: project || null,
    status: "active",
    createdAt: now,
    createdInSession: sessionId || null,
    completedAt: null,
    tasks: missionTasks,
  };

  brain.missions.push(mission);
  saveBrain(brain);

  broadcastEvent("mission-created", { mission, ts: now });
  fireWebhooks(brain, "mission-created", "missions", mission.name);
  console.log(`[brain] mission created: ${mission.id} — ${mission.name}`);
  res.status(201).json(mission);
});

// GET /missions/resume — resumable work for a session
// (Defined before /:id to avoid route conflict)
router.get("/resume", (req, res) => {
  const projectFilter = req.query.project || "";
  const brain = loadBrain();

  const results = [];
  for (const m of (brain.missions || [])) {
    if (m.status !== "active") continue;
    if (projectFilter && m.project !== projectFilter) continue;

    const resumableTasks = (m.tasks || []).filter(t => ["pending", "in_progress", "blocked"].includes(t.status));
    if (resumableTasks.length === 0) continue;

    const counts = { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
    for (const t of (m.tasks || [])) counts[t.status] = (counts[t.status] || 0) + 1;

    results.push({
      id: m.id,
      name: m.name,
      project: m.project,
      pendingTasks: counts.pending,
      inProgressTasks: counts.in_progress,
      completedTasks: counts.completed,
      blockedTasks: counts.blocked,
      tasks: resumableTasks,
    });
  }

  res.json({ missions: results });
});

// GET /missions/agents — agent execution stats
router.get("/agents", (req, res) => {
  const brain = loadBrain();
  const agentMap = {};

  for (const m of (brain.missions || [])) {
    for (const t of (m.tasks || [])) {
      if (!t.assignedAgent) continue;
      const name = t.assignedAgent;
      if (!agentMap[name]) {
        agentMap[name] = { name, taskCount: 0, completedCount: 0, failedCount: 0, blockedCount: 0, inProgressCount: 0, totalDurationMs: 0, durationTasks: 0, lastUsed: null, recentTasks: [] };
      }
      const a = agentMap[name];
      a.taskCount++;
      if (t.status === "completed") a.completedCount++;
      if (t.status === "blocked") a.blockedCount++;
      if (t.status === "in_progress") a.inProgressCount++;

      // Duration calc
      if (t.startedAt && t.completedAt) {
        const dur = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
        if (dur > 0) { a.totalDurationMs += dur; a.durationTasks++; }
      }

      // Track lastUsed
      const taskTime = t.completedAt || t.startedAt || t.createdAt;
      if (taskTime && (!a.lastUsed || taskTime > a.lastUsed)) a.lastUsed = taskTime;

      a.recentTasks.push({
        id: t.id,
        description: t.description,
        status: t.status,
        output: t.output,
        missionId: m.id,
        missionName: m.name,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
      });
    }
  }

  const result = Object.values(agentMap).map(a => ({
    ...a,
    avgDurationMs: a.durationTasks > 0 ? Math.round(a.totalDurationMs / a.durationTasks) : 0,
    recentTasks: a.recentTasks.sort((x, y) => (y.completedAt || y.startedAt || "").localeCompare(x.completedAt || x.startedAt || "")).slice(0, 10),
  }));
  // Remove internal fields
  result.forEach(a => { delete a.totalDurationMs; delete a.durationTasks; });
  res.json(result.sort((a, b) => (b.lastUsed || "").localeCompare(a.lastUsed || "")));
});

// GET /missions — list missions
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "";
  const projectFilter = req.query.project || "";
  const brain = loadBrain();

  let missions = brain.missions || [];
  if (statusFilter) missions = missions.filter(m => m.status === statusFilter);
  if (projectFilter) missions = missions.filter(m => m.project === projectFilter);

  const summary = missions.map(m => {
    const counts = { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
    for (const t of (m.tasks || [])) counts[t.status] = (counts[t.status] || 0) + 1;
    return {
      id: m.id,
      name: m.name,
      project: m.project,
      status: m.status,
      createdAt: m.createdAt,
      completedAt: m.completedAt,
      taskCounts: counts,
    };
  });

  res.json(summary);
});

// GET /missions/:id — single mission with full task details
router.get("/:id", (req, res) => {
  const brain = loadBrain();
  const mission = (brain.missions || []).find(m => m.id === req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });
  res.json(mission);
});

// PATCH /missions/:id — update mission
router.patch("/:id", (req, res) => {
  const brain = loadBrain();
  const mission = (brain.missions || []).find(m => m.id === req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const { name, status, project } = req.body;
  const now = new Date().toISOString();

  if (name !== undefined) mission.name = name;
  if (project !== undefined) mission.project = project;
  if (status !== undefined) {
    if (!VALID_MISSION_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_MISSION_STATUSES].join(", ")}` });
    }
    mission.status = status;
    if ((status === "completed" || status === "abandoned") && !mission.completedAt) {
      mission.completedAt = now;
    }
  }

  saveBrain(brain);
  broadcastEvent("mission-updated", { mission, ts: now });
  fireWebhooks(brain, "mission-updated", "missions", mission.name);
  console.log(`[brain] mission updated: ${mission.id} — status=${mission.status}`);
  res.json(mission);
});

// DELETE /missions/:id — delete a mission entirely
router.delete("/:id", (req, res) => {
  const brain = loadBrain();
  const idx = (brain.missions || []).findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Mission not found" });

  const removed = brain.missions.splice(idx, 1)[0];
  saveBrain(brain);
  broadcastEvent("mission-updated", { id: removed.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks(brain, "mission-deleted", "missions", removed.name);
  console.log(`[brain] mission deleted: ${removed.id} — ${removed.name}`);
  res.json({ ok: true });
});

// POST /missions/:id/tasks — add tasks to an existing mission
router.post("/:id/tasks", (req, res) => {
  const brain = loadBrain();
  const mission = (brain.missions || []).find(m => m.id === req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "Missing or empty tasks array" });
  }

  const now = new Date().toISOString();

  // Collect all existing task IDs for uniqueness
  const existingTaskIds = new Set();
  for (const m of (brain.missions || [])) {
    for (const t of (m.tasks || [])) existingTaskIds.add(t.id);
  }

  const newTasks = tasks.map(t => {
    const taskId = slugify(t.description, "t", existingTaskIds);
    existingTaskIds.add(taskId);
    return {
      id: taskId,
      description: t.description,
      status: "pending",
      assignedAgent: null,
      sessionId: null,
      output: null,
      blockers: [],
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };
  });

  mission.tasks.push(...newTasks);
  saveBrain(brain);

  broadcastEvent("task-updated", { missionId: mission.id, added: newTasks.length, ts: now });
  fireWebhooks(brain, "task-updated", "missions", `${newTasks.length} tasks added to ${mission.name}`);
  console.log(`[brain] ${newTasks.length} tasks added to mission ${mission.id}`);
  res.status(201).json(newTasks);
});

// PATCH /missions/:id/tasks/:taskId — update a task
router.patch("/:id/tasks/:taskId", (req, res) => {
  const brain = loadBrain();
  const mission = (brain.missions || []).find(m => m.id === req.params.id);
  if (!mission) return res.status(404).json({ error: "Mission not found" });

  const task = (mission.tasks || []).find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const { status, assignedAgent, sessionId, output, blockers, description } = req.body;
  const now = new Date().toISOString();

  if (description !== undefined) task.description = description;
  if (assignedAgent !== undefined) task.assignedAgent = assignedAgent;
  if (sessionId !== undefined) task.sessionId = sessionId;
  if (output !== undefined) task.output = output;
  if (blockers !== undefined) task.blockers = blockers;
  if (status !== undefined) {
    if (!VALID_TASK_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_TASK_STATUSES].join(", ")}` });
    }
    task.status = status;
    if (status === "in_progress" && !task.startedAt) task.startedAt = now;
    if (status === "completed" && !task.completedAt) task.completedAt = now;
  }

  // Auto-complete mission if all tasks are completed
  const allCompleted = mission.tasks.every(t => t.status === "completed");
  if (allCompleted && mission.status === "active") {
    mission.status = "completed";
    mission.completedAt = now;
    broadcastEvent("mission-updated", { mission, ts: now });
    fireWebhooks(brain, "mission-updated", "missions", `${mission.name} auto-completed`);
    console.log(`[brain] mission auto-completed: ${mission.id}`);
  }

  saveBrain(brain);
  broadcastEvent("task-updated", { missionId: mission.id, task, ts: now });
  fireWebhooks(brain, "task-updated", "missions", `${task.description} → ${task.status}`);
  console.log(`[brain] task updated: ${task.id} in ${mission.id} — status=${task.status}`);
  res.json(task);
});

export default router;
