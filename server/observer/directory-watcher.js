// observer/directory-watcher.js — failsafe directory watcher for agent JSONL discovery
// Polls ~/.claude/projects/ for new/growing .jsonl files and auto-registers them
// with the observer. Complements the hook-based registration path.

import fs from "fs";
import path from "path";
import os from "os";
import { watchAgent, getActiveWatchers } from "./watcher.js";

const PREFIX = "[observer:dir-watcher]";

// State
let pollTimer = null;
let knownFiles = new Map(); // path → { size, registeredAt }
let currentOptions = null;

/**
 * Recursively find all .jsonl files under a directory.
 * Returns array of { filePath, stats }.
 */
function scanForJsonl(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        results.push(...scanForJsonl(full));
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const stats = fs.statSync(full);
        results.push({ filePath: full, stats });
      }
    } catch {
      // Permission error, file gone, etc. — skip.
    }
  }
  return results;
}

/**
 * Extract session ID from filename. Format: <uuid>.jsonl
 */
function extractSessionId(filePath) {
  const base = path.basename(filePath, ".jsonl");
  return base || "unknown-session";
}

/**
 * Extract agent name from directory structure.
 * Main session files live in ~/.claude/projects/<project-hash>/<session>.jsonl
 * Subagent files live in ~/.claude/projects/<project-hash>/<subdir>/<session>.jsonl
 *
 * If the file is in a subdirectory under the project hash dir, use that subdir name.
 * Otherwise default to "main-agent".
 */
function extractAgentName(filePath, projectsDir) {
  const normalized = filePath.replace(/\\/g, "/");
  const normalizedBase = projectsDir.replace(/\\/g, "/");

  // Strip the projects dir prefix to get relative path
  const relative = normalized.startsWith(normalizedBase)
    ? normalized.slice(normalizedBase.length).replace(/^\//, "")
    : path.basename(filePath);

  // relative is like: <project-hash>/<session>.jsonl (main)
  // or: <project-hash>/<subdir>/<session>.jsonl (subagent)
  const parts = relative.split("/");
  if (parts.length >= 3) {
    // Has subdirectory — use it as agent name
    return parts[parts.length - 2];
  }
  return "main-agent";
}

/**
 * Check if a file path is already being watched by the observer.
 */
function isAlreadyWatched(filePath) {
  const active = getActiveWatchers();
  const normalized = filePath.replace(/\\/g, "/");
  return active.some(w => w.jsonlPath.replace(/\\/g, "/") === normalized);
}

/**
 * Register a discovered file with the observer.
 */
function registerFile(filePath, reason, options) {
  if (isAlreadyWatched(filePath)) return;

  const sessionId = extractSessionId(filePath);
  const agentName = extractAgentName(filePath, options.projectsDir);

  try {
    const result = watchAgent({
      sessionId,
      jsonlPath: filePath,
      agentName,
    });
    if (result.error) {
      // Already watching via another path — not a problem.
      return;
    }
    console.log(`${PREFIX} discovered ${filePath} (${reason})`);
  } catch (err) {
    console.warn(`${PREFIX} failed to register ${filePath}: ${err.message}`);
  }
}

/**
 * Single poll cycle: scan directory, detect new/growing files, register them.
 */
function poll(options) {
  const now = Date.now();
  const files = scanForJsonl(options.projectsDir);

  for (const { filePath, stats } of files) {
    const mtimeMs = stats.mtimeMs || stats.mtime?.getTime() || 0;
    const age = now - mtimeMs;

    // Skip files older than maxAgeMs.
    if (age > options.maxAgeMs) continue;

    const known = knownFiles.get(filePath);

    if (!known) {
      // New file.
      knownFiles.set(filePath, { size: stats.size, registeredAt: now });
      if (stats.size > 0) {
        registerFile(filePath, "new file", options);
      }
    } else if (stats.size > known.size) {
      // File grew.
      knownFiles.set(filePath, { size: stats.size, registeredAt: known.registeredAt });
      registerFile(filePath, "resumed growth", options);
    } else {
      // Update size tracking even if unchanged (handles external truncation).
      knownFiles.set(filePath, { ...known, size: stats.size });
    }
  }
}

/**
 * Start the directory watcher.
 * @param {Object} options
 * @param {string} [options.projectsDir] — directory to watch (default: ~/.claude/projects/)
 * @param {number} [options.pollInterval] — ms between polls (default: 10000)
 * @param {boolean} [options.enabled] — whether to run (default: true)
 * @param {number} [options.maxAgeMs] — max file age to consider (default: 3600000 = 1hr)
 */
export function startDirectoryWatcher(options = {}) {
  const resolved = {
    projectsDir: options.projectsDir || path.join(os.homedir(), ".claude", "projects"),
    pollInterval: options.pollInterval || 10000,
    enabled: options.enabled !== undefined ? options.enabled : true,
    maxAgeMs: options.maxAgeMs || 3600000,
  };

  if (!resolved.enabled) {
    console.log(`${PREFIX} disabled by config`);
    return;
  }

  // Normalize path separators.
  resolved.projectsDir = resolved.projectsDir.replace(/\\/g, "/");

  if (!fs.existsSync(resolved.projectsDir)) {
    console.log(`${PREFIX} projects dir not found: ${resolved.projectsDir} — will retry on next poll`);
  }

  // Stop existing watcher if running.
  stopDirectoryWatcher();

  knownFiles = new Map();
  currentOptions = resolved;

  // Initial poll.
  try {
    poll(resolved);
  } catch (err) {
    console.warn(`${PREFIX} initial poll error: ${err.message}`);
  }

  // Schedule recurring polls.
  pollTimer = setInterval(() => {
    try {
      poll(resolved);
    } catch (err) {
      console.warn(`${PREFIX} poll error: ${err.message}`);
    }
  }, resolved.pollInterval);

  console.log(`${PREFIX} started — watching ${resolved.projectsDir} every ${resolved.pollInterval}ms (max age: ${resolved.maxAgeMs}ms)`);
}

/**
 * Stop the directory watcher.
 */
export function stopDirectoryWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  knownFiles = new Map();
  currentOptions = null;
  console.log(`${PREFIX} stopped`);
}
