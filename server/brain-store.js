// brain-store.js — brain file I/O and migration logic

import fs from "fs";
import os from "os";
import path from "path";
import { slugify } from "./text-utils.js";

// Resolve brain file path: env var > ~/.claude/brain.json
const defaultBrainFile = path.join(os.homedir(), ".claude", "brain.json");
export const BRAIN_FILE = process.env.BRAIN_FILE || defaultBrainFile;

export const DEFAULT_PROJECTS = [
  { id: "general", name: "General", repos: [], status: "active" },
];

// In-memory cache — avoids redundant disk reads within a single server process
let brainCache = null;

export const invalidateCache = () => { brainCache = null; };

export const loadBrain = () => {
  if (brainCache !== null) {
    return JSON.parse(JSON.stringify(brainCache));
  }

  try {
    const brain = JSON.parse(fs.readFileSync(BRAIN_FILE, "utf8"));
    if (!brain.archived) brain.archived = [];
    if (!brain.webhooks) brain.webhooks = [];
    if (!brain.missions) brain.missions = [];
    if (!brain.profiles) brain.profiles = [];
    if (!brain.projects || brain.projects.length === 0) brain.projects = [...DEFAULT_PROJECTS];

    brainCache = brain;
    return JSON.parse(JSON.stringify(brainCache));
  } catch (err) {
    // Before overwriting, back up the existing file if it has content
    const bakFile = BRAIN_FILE + ".bak";
    try {
      const existing = fs.readFileSync(BRAIN_FILE);
      if (existing.length > 10) {
        fs.writeFileSync(bakFile, existing);
        console.log(`[brain] backed up corrupted brain file to ${bakFile} (${existing.length} bytes)`);
      }
    } catch { /* no file to back up */ }

    console.error(`[brain] failed to load brain file: ${err.message}`);
    const initial = { workingStyle: [], architecture: [], agentRules: [], decisions: [], log: [], archived: [], webhooks: [], missions: [], profiles: [], projects: [...DEFAULT_PROJECTS] };
    const dir = path.dirname(BRAIN_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BRAIN_FILE, JSON.stringify(initial, null, 2));
    console.log(`[brain] created new brain file at ${BRAIN_FILE}`);
    brainCache = initial;
    return JSON.parse(JSON.stringify(brainCache));
  }
};

export const saveBrain = (brain) => {
  // Rotate backups: .bak → .bak.1 → .bak.2 → .bak.3 (3 generations)
  try { fs.renameSync(BRAIN_FILE + ".bak.2", BRAIN_FILE + ".bak.3"); } catch { /* not present yet */ }
  try { fs.renameSync(BRAIN_FILE + ".bak.1", BRAIN_FILE + ".bak.2"); } catch { /* not present yet */ }
  try { fs.renameSync(BRAIN_FILE + ".bak", BRAIN_FILE + ".bak.1"); } catch { /* not present yet */ }
  try {
    const existing = fs.readFileSync(BRAIN_FILE);
    if (existing.length > 10) {
      fs.writeFileSync(BRAIN_FILE + ".bak", existing);
    }
  } catch { /* first write, no file yet */ }

  // Atomic write: write to .tmp then rename over brain.json
  const tmpFile = BRAIN_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(brain, null, 2));
  fs.renameSync(tmpFile, BRAIN_FILE);

  // Update cache
  brainCache = brain;
};

// runMigrations — extract and apply one-time data migrations, then save if changed
export const runMigrations = () => {
  const brain = loadBrain();
  let changed = false;

  // Migration: convert string project fields to arrays
  const migrateEntry = (entry) => {
    if (typeof entry !== "object" || entry === null) return;
    if (!entry.project) {
      entry.project = ["general"];
      changed = true;
    } else if (typeof entry.project === "string") {
      entry.project = [entry.project];
      changed = true;
    }
  };
  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    for (const entry of (brain[section] || [])) migrateEntry(entry);
  }
  for (const entry of (brain.decisions || [])) migrateEntry(entry);
  for (const entry of (brain.archived || [])) migrateEntry(entry);
  if (changed) {
    console.log("[brain] migrated project fields from string to array format");
  }

  // Migration: convert hex-based mission/task IDs to slug-based IDs
  const hexIdPattern = /^[mt]-[0-9a-f]{8}$/;
  const usedMissionIds = new Set();
  const usedTaskIds = new Set();
  // First pass: collect non-hex IDs that should be kept
  for (const m of (brain.missions || [])) {
    if (!hexIdPattern.test(m.id)) usedMissionIds.add(m.id);
    for (const t of (m.tasks || [])) {
      if (!hexIdPattern.test(t.id)) usedTaskIds.add(t.id);
    }
  }
  // Second pass: migrate hex IDs to slugs
  for (const m of (brain.missions || [])) {
    if (hexIdPattern.test(m.id)) {
      const newId = slugify(m.name, "m", usedMissionIds);
      usedMissionIds.add(newId);
      console.log(`[brain] migrating mission ID: ${m.id} → ${newId}`);
      m.id = newId;
      changed = true;
    }
    for (const t of (m.tasks || [])) {
      if (hexIdPattern.test(t.id)) {
        const newId = slugify(t.description, "t", usedTaskIds);
        usedTaskIds.add(newId);
        t.id = newId;
        changed = true;
      }
    }
  }
  if (changed) {
    // Invalidate so saveBrain writes fresh state
    brainCache = null;
    saveBrain(brain);
    console.log("[brain] migrations complete, brain saved");
  }
};
