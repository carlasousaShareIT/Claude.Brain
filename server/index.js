#!/usr/bin/env node
// server/index.js — brain server entry point

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { startHeartbeat } from "./broadcast.js";
import { mergeBrains } from "./merge-utils.js";
import { getDb, DB_FILE, backupDb, startBackupSchedule, closeDb } from "./db.js";
import { migrateJsonToDb } from "./migrate-json-to-db.js";
import { getFullBrain } from "./db-store.js";

import memoryRouter from "./routes/memory.js";
import archiveRouter from "./routes/archive.js";
import annotationsRouter from "./routes/annotations.js";
import metricsRouter from "./routes/metrics.js";
import webhooksRouter from "./routes/webhooks.js";
import projectsRouter from "./routes/projects.js";
import profilesRouter from "./routes/profiles.js";
import missionsRouter from "./routes/missions.js";
import remindersRouter from "./routes/reminders.js";
import experimentsRouter from "./routes/experiments.js";
import sessionsRouter from "./routes/sessions.js";
import locksRouter from "./routes/locks.js";
import agentsRouter from "./routes/agents.js";
import orchestrationRouter from "./routes/orchestration.js";
import sseRouter from "./routes/sse.js";
import auditRouter from "./routes/audit.js";
import observerRouter from "./routes/observer.js";
import { startAuditSchedule, stopAuditSchedule } from "./brain-audit.js";
import { cleanup as cleanupObserver } from "./observer/watcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 7777;

console.log("__dirname:", __dirname);
console.log("DB_FILE:", DB_FILE);

// Initialize SQLite database and run JSON migration
getDb();
migrateJsonToDb();

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost or 127.0.0.1 origin on any port
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocal) return callback(null, true);
    callback(new Error("CORS: origin not allowed"));
  },
}));
app.use(express.json());

// Serve React app in production, dev message otherwise
app.get("/", (req, res) => {
  const distDir = path.join(__dirname, "..", "dist");
  const indexFile = path.join(distDir, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(200).send(`
    <h3>Brain App</h3>
    <p>No production build found. Run <code>npm run dev</code> to start the dev server.</p>
    <p>Looking in: <code>${distDir}</code></p>
  `);
});

// Mount route modules
app.use(memoryRouter);
app.use(archiveRouter);
app.use(annotationsRouter);
app.use(metricsRouter);
app.use(webhooksRouter);
app.use(projectsRouter);
app.use(profilesRouter);
app.use(sseRouter);
app.use("/missions", missionsRouter);
app.use("/reminders", remindersRouter);
app.use("/experiments", experimentsRouter);
app.use("/sessions", sessionsRouter);
app.use("/locks", locksRouter);
app.use("/agents", agentsRouter);
app.use("/orchestration", orchestrationRouter);
app.use("/audit", auditRouter);
app.use("/observer", observerRouter);

// POST /memory/merge — merge external brain data
app.post("/memory/merge", (req, res, next) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "Invalid body" });
    }

    const server = getFullBrain();
    const merged = mergeBrains(server, incoming);
    // Note: merge is a legacy operation — for now, return the merged view without persisting.
    // Full merge-to-db support can be added later if needed.
    console.log("[brain] merge requested (read-only in SQLite mode)");
    res.json(merged);
  } catch (err) {
    next(err);
  }
});

// Serve static assets from dist (after API routes to avoid interception)
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Global error handler — must be defined after all route mounts
app.use((err, req, res, next) => {
  console.error(`[brain] unhandled error on ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: "Internal server error" });
});

// Catch-all for SPA routing in production
app.get("/{*splat}", (req, res) => {
  const indexFile = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(404).json({ error: "Not found" });
});

// Create initial backup and start periodic backup schedule
backupDb();
startBackupSchedule();

// Start heartbeat for SSE
startHeartbeat();

// Start brain audit schedule
startAuditSchedule();

// Graceful shutdown
process.on("SIGINT", () => { cleanupObserver(); stopAuditSchedule(); closeDb(); process.exit(0); });
process.on("SIGTERM", () => { cleanupObserver(); stopAuditSchedule(); closeDb(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`\n🧠 Brain server running at http://localhost:${PORT}`);
  console.log(`   Database:   ${DB_FILE}`);
  console.log(`   UI:         http://localhost:${PORT}`);
  console.log(`   POST /memory            — write updates`);
  console.log(`   POST /memory/batch      — batch write (multiple ops)`);
  console.log(`   GET  /memory            — read brain`);
  console.log(`   GET  /memory/search     — search entries (?q=keyword)`);
  console.log(`   GET  /memory/sessions   — list sessions`);
  console.log(`   POST /memory/auto       — auto-categorize and add`);
  console.log(`   POST /memory/confidence — update entry confidence`);
  console.log(`   POST /memory/archive    — archive an entry`);
  console.log(`   GET  /memory/archived   — list archived entries`);
  console.log(`   POST /memory/unarchive  — restore archived entry`);
  console.log(`   GET  /memory/context    — brain as markdown for LLM (?project=, ?mission=)`);
  console.log(`   GET  /memory/stream     — SSE live pulse`);
  console.log(`   GET  /memory/timeline   — time-travel data`);
  console.log(`   POST /memory/check      — conflict detection`);
  console.log(`   POST /memory/annotate   — add annotation`);
  console.log(`   DELETE /memory/annotate — remove annotation`);
  console.log(`   GET  /memory/annotations — list annotated entries`);
  console.log(`   GET  /memory/metrics    — brain health stats`);
  console.log(`   POST /memory/webhooks   — register webhook`);
  console.log(`   DELETE /memory/webhooks — remove webhook`);
  console.log(`   GET  /memory/webhooks   — list webhooks`);
  console.log(`   GET  /memory/projects   — list project definitions`);
  console.log(`   POST /memory/projects   — add/update project`);
  console.log(`   DELETE /memory/projects — remove project`);
  console.log(`   POST /memory/retag      — change entry project tag(s)`);
  console.log(`   POST /memory/diff           — post-task brain diff`);
  console.log(`   POST /memory/projects/close  — close project, archive exclusive entries`);
  console.log(`   POST /memory/projects/reopen — reopen project, unarchive entries`);
  console.log(`   POST /missions              — create a mission`);
  console.log(`   GET  /missions              — list missions (?status=, ?project=)`);
  console.log(`   GET  /missions/resume       — resumable work (?project=)`);
  console.log(`   GET  /missions/:id          — single mission with tasks`);
  console.log(`   PATCH /missions/:id         — update mission`);
  console.log(`   DELETE /missions/:id        — delete mission`);
  console.log(`   POST /missions/:id/tasks    — add tasks to mission`);
  console.log(`   PATCH /missions/:id/tasks/:taskId — update a task`);
  console.log(`   POST /reminders              — create a reminder`);
  console.log(`   GET  /reminders              — list reminders (?status=, ?project=, ?due=overdue)`);
  console.log(`   PATCH /reminders/:id         — update a reminder`);
  console.log(`   DELETE /reminders/:id        — delete a reminder`);
  console.log(`   POST /experiments               — create an experiment`);
  console.log(`   GET  /experiments               — list experiments (?status=, ?project=)`);
  console.log(`   GET  /experiments/:id            — single experiment with observations`);
  console.log(`   PATCH /experiments/:id           — update/conclude experiment`);
  console.log(`   POST /experiments/:id/observations — record observation`);
  console.log(`   DELETE /experiments/:id          — delete experiment`);
  console.log(`   POST /sessions/start         — start a session`);
  console.log(`   POST /sessions/:id/end       — end a session with handoff`);
  console.log(`   GET  /sessions               — list sessions`);
  console.log(`   GET  /sessions/latest/handoff — latest handoff summary`);
  console.log(`   GET  /sessions/:id           — single session`);
  console.log(`   GET  /audit/reports          — list audit reports`);
  console.log(`   GET  /audit/reports/latest   — latest audit report`);
  console.log(`   POST /audit/run              — trigger manual audit`);
  console.log(`   POST /audit/dismiss          — dismiss a finding`);
  console.log(`   POST /audit/promote          — promote decision to architecture`);
  console.log(`   POST /audit/merge            — merge duplicate entries`);
  console.log(`   POST /observer/watch         — start watching agent JSONL`);
  console.log(`   POST /observer/unwatch       — stop watching, get final metrics`);
  console.log(`   GET  /observer/watchers      — list active watchers`);
  console.log(`   GET  /observer/violations    — list violations (?session, ?agent, ?type)`);
  console.log(`   GET  /observer/violations/stats — violation rates by agent`);
  console.log(`   GET  /observer/config        — observer config (calibration mode)`);
  console.log(`   PATCH /observer/config       — update observer config\n`);
});
