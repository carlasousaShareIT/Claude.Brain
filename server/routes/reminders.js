// routes/reminders.js — reminder CRUD

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { slugify } from "../text-utils.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_STATUSES = new Set(["pending", "done", "snoozed"]);
const VALID_PRIORITIES = new Set(["low", "normal", "high"]);
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

const router = Router();

// Auto-unsnooze reminders whose snoozedUntil has passed
const applyAutoUnsnooze = (reminders) => {
  const now = new Date().toISOString();
  let changed = false;
  for (const r of reminders) {
    if (r.status === "snoozed" && r.snoozedUntil && r.snoozedUntil <= now) {
      r.status = "pending";
      r.snoozedUntil = null;
      changed = true;
    }
  }
  return changed;
};

const sortReminders = (reminders) => {
  return [...reminders].sort((a, b) => {
    // Priority: high first
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    // dueDate: earliest first (nulls last)
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    // createdAt: earliest first
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
};

// POST /reminders — create a reminder
router.post("/", (req, res) => {
  const { text, dueDate, priority, project } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const resolvedPriority = priority || "normal";
  if (!VALID_PRIORITIES.has(resolvedPriority)) {
    return res.status(400).json({ error: `Invalid priority "${resolvedPriority}". Must be one of: ${[...VALID_PRIORITIES].join(", ")}` });
  }

  const now = new Date().toISOString();
  const brain = loadBrain();
  const existingIds = new Set((brain.reminders || []).map(r => r.id));
  const id = slugify(text, "r", existingIds);

  const reminder = {
    id,
    text,
    status: "pending",
    priority: resolvedPriority,
    dueDate: dueDate || null,
    project: project ? (Array.isArray(project) ? project : [project]) : ["general"],
    createdAt: now,
    completedAt: null,
    snoozedUntil: null,
  };

  brain.reminders.push(reminder);
  saveBrain(brain);

  broadcastEvent("reminder-created", { reminder, ts: now });
  fireWebhooks(brain, "reminder-created", "reminders", reminder.text);
  console.log(`[brain] reminder created: ${reminder.id} — ${reminder.text}`);
  res.status(201).json(reminder);
});

// GET /reminders — list reminders
// Query: ?status=pending|done|snoozed|all (default: pending), ?project=<id>, ?due=overdue
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "pending";
  const projectFilter = req.query.project || "";
  const dueFilter = req.query.due || "";

  const brain = loadBrain();
  const changed = applyAutoUnsnooze(brain.reminders || []);
  if (changed) saveBrain(brain);

  let reminders = brain.reminders || [];

  if (statusFilter !== "all") {
    reminders = reminders.filter(r => r.status === statusFilter);
  }

  if (projectFilter) {
    reminders = reminders.filter(r => (r.project || []).includes(projectFilter));
  }

  if (dueFilter === "overdue") {
    const now = new Date().toISOString();
    reminders = reminders.filter(r => r.dueDate && r.dueDate < now && r.status !== "done");
  }

  res.json(sortReminders(reminders));
});

// PATCH /reminders/:id — update a reminder
router.patch("/:id", (req, res) => {
  const brain = loadBrain();
  const reminder = (brain.reminders || []).find(r => r.id === req.params.id);
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });

  const { text, status, priority, dueDate, snoozedUntil, project } = req.body;
  const now = new Date().toISOString();

  if (text !== undefined) reminder.text = text;
  if (dueDate !== undefined) reminder.dueDate = dueDate;
  if (project !== undefined) reminder.project = Array.isArray(project) ? project : [project];

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({ error: `Invalid priority "${priority}". Must be one of: ${[...VALID_PRIORITIES].join(", ")}` });
    }
    reminder.priority = priority;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` });
    }
    reminder.status = status;
    if (status === "done" && !reminder.completedAt) reminder.completedAt = now;
    if (status !== "done") reminder.completedAt = null;
    if (status !== "snoozed") reminder.snoozedUntil = null;
    if (status === "snoozed" && snoozedUntil !== undefined) reminder.snoozedUntil = snoozedUntil;
  }

  // snoozedUntil without status change — allow direct update
  if (status === undefined && snoozedUntil !== undefined) reminder.snoozedUntil = snoozedUntil;

  saveBrain(brain);
  broadcastEvent("reminder-updated", { reminder, ts: now });
  fireWebhooks(brain, "reminder-updated", "reminders", reminder.text);
  console.log(`[brain] reminder updated: ${reminder.id} — status=${reminder.status}`);
  res.json(reminder);
});

// DELETE /reminders/:id — remove a reminder
router.delete("/:id", (req, res) => {
  const brain = loadBrain();
  const idx = (brain.reminders || []).findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Reminder not found" });

  const removed = brain.reminders.splice(idx, 1)[0];
  saveBrain(brain);
  broadcastEvent("reminder-deleted", { id: removed.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks(brain, "reminder-deleted", "reminders", removed.text);
  console.log(`[brain] reminder deleted: ${removed.id} — ${removed.text}`);
  res.json({ ok: true });
});

export default router;
