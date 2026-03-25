#!/usr/bin/env node
// server/index.js — brain server entry point

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { BRAIN_FILE } from "./brain-store.js";
import { startHeartbeat } from "./broadcast.js";
import { mergeBrains } from "./merge-utils.js";
import { loadBrain, saveBrain } from "./brain-store.js";

import memoryRouter from "./routes/memory.js";
import archiveRouter from "./routes/archive.js";
import annotationsRouter from "./routes/annotations.js";
import metricsRouter from "./routes/metrics.js";
import webhooksRouter from "./routes/webhooks.js";
import projectsRouter from "./routes/projects.js";
import missionsRouter from "./routes/missions.js";
import sseRouter from "./routes/sse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 7777;

console.log("__dirname:", __dirname);
console.log("BRAIN_FILE:", BRAIN_FILE);

const app = express();
app.use(cors());
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

// Serve static assets from dist
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Mount route modules
app.use(memoryRouter);
app.use(archiveRouter);
app.use(annotationsRouter);
app.use(metricsRouter);
app.use(webhooksRouter);
app.use(projectsRouter);
app.use(sseRouter);
app.use("/missions", missionsRouter);

// Fix: POST /memory/merge needs mergeBrains — override the placeholder in memory router
// The merge route is defined here since it needs cross-module import
app.post("/memory/merge", (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const server = loadBrain();
  const merged = mergeBrains(server, incoming);
  saveBrain(merged);
  console.log("[brain] merged artifact storage into brain.json");
  res.json(merged);
});

// Catch-all for SPA routing in production
app.get("/{*splat}", (req, res) => {
  const indexFile = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(404).json({ error: "Not found" });
});

// Start heartbeat for SSE
startHeartbeat();

app.listen(PORT, () => {
  console.log(`\n🧠 Brain server running at http://localhost:${PORT}`);
  console.log(`   Brain file: ${BRAIN_FILE}`);
  console.log(`   UI:         http://localhost:${PORT}`);
  console.log(`   POST /memory            — write updates`);
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
  console.log(`   PATCH /missions/:id/tasks/:taskId — update a task\n`);
});
