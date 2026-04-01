// routes/reminders.js — reminder CRUD

import { Router } from "express";
import {
  createReminder,
  getReminders,
  updateReminder,
  deleteReminder,
  applyAutoUnsnooze,
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_STATUSES = new Set(["pending", "done", "snoozed"]);
const VALID_PRIORITIES = new Set(["low", "normal", "high"]);

const router = Router();

// POST /reminders — create a reminder
router.post("/", (req, res) => {
  const { text, dueDate, priority, project } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const resolvedPriority = priority || "normal";
  if (!VALID_PRIORITIES.has(resolvedPriority)) {
    return res.status(400).json({ error: `Invalid priority "${resolvedPriority}". Must be one of: ${[...VALID_PRIORITIES].join(", ")}` });
  }

  const reminder = createReminder({ text, priority: resolvedPriority, dueDate, project });
  const now = new Date().toISOString();

  broadcastEvent("reminder-created", { reminder, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "reminder-created", "reminders", reminder.text);
  console.log(`[brain] reminder created: ${reminder.id} — ${reminder.text}`);
  res.status(201).json(reminder);
});

// GET /reminders — list reminders
// Query: ?status=pending|done|snoozed|all (default: pending), ?project=<id>, ?due=overdue
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "pending";
  const projectFilter = req.query.project || "";
  const dueFilter = req.query.due || "";

  applyAutoUnsnooze();
  const reminders = getReminders(statusFilter, projectFilter, dueFilter);
  res.json(reminders);
});

// PATCH /reminders/:id — update a reminder
router.patch("/:id", (req, res) => {
  const { text, status, priority, dueDate, snoozedUntil, project } = req.body;

  if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ error: `Invalid priority "${priority}". Must be one of: ${[...VALID_PRIORITIES].join(", ")}` });
  }

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` });
  }

  const reminder = updateReminder(req.params.id, { text, status, priority, dueDate, snoozedUntil, project });
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });

  const now = new Date().toISOString();
  broadcastEvent("reminder-updated", { reminder, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "reminder-updated", "reminders", reminder.text);
  console.log(`[brain] reminder updated: ${reminder.id} — status=${reminder.status}`);
  res.json(reminder);
});

// DELETE /reminders/:id — remove a reminder
router.delete("/:id", (req, res) => {
  // Look up reminder before deleting (deleteReminder returns boolean, not object)
  const all = getReminders("all", "", "");
  const existing = all.find(r => r.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Reminder not found" });

  deleteReminder(req.params.id);
  broadcastEvent("reminder-deleted", { id: existing.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks({ webhooks: getWebhooks() }, "reminder-deleted", "reminders", existing.text);
  console.log(`[brain] reminder deleted: ${existing.id} — ${existing.text}`);
  res.json({ ok: true });
});

export default router;
