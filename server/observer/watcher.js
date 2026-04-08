// observer/watcher.js — JSONL file tailing + observer engine management
// Uses polling (not fs.watch) for Windows reliability.

import fs from "fs";
import { ObserverEngine } from "./engine.js";
import { createViolation, createAgentMetrics, getProfiles } from "../db-store.js";
import { broadcastEvent } from "../broadcast.js";

const POLL_INTERVAL_MS = 2500; // 2.5 seconds
const FORMAT_DRIFT_THRESHOLD = 0.2; // 20% unknown events → warning

// Known JSONL event types from Claude Code
const KNOWN_EVENT_TYPES = new Set([
  "tool_use", "tool_result", "text", "error",
  "assistant", "user", "system", "result",
]);

// Observer config (calibration mode)
let observerConfig = {
  mode: "passive", // "passive" | "active"
};

export const getObserverConfig = () => ({ ...observerConfig });

export const setObserverConfig = (updates) => {
  if (updates.mode && ["passive", "active"].includes(updates.mode)) {
    observerConfig.mode = updates.mode;
  }
  return getObserverConfig();
};

// ---------------------------------------------------------------------------
// FileTailer — polls a file for new content from a byte offset
// ---------------------------------------------------------------------------

class FileTailer {
  constructor(filePath, onLines) {
    this._filePath = filePath;
    this._onLines = onLines;
    this._offset = 0;
    this._timer = null;
    this._buffer = ""; // partial line buffer
  }

  start() {
    // Initialize offset to current file size (only tail new content)
    try {
      const stats = fs.statSync(this._filePath);
      this._offset = stats.size;
    } catch {
      this._offset = 0;
    }

    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    console.log(`[observer] tailing ${this._filePath} from offset ${this._offset}`);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _poll() {
    let stats;
    try {
      stats = fs.statSync(this._filePath);
    } catch {
      return; // file may not exist yet or be temporarily locked
    }

    if (stats.size <= this._offset) {
      // File truncated or no new data
      if (stats.size < this._offset) this._offset = stats.size;
      return;
    }

    const bytesToRead = stats.size - this._offset;
    const buf = Buffer.alloc(bytesToRead);
    let fd;
    try {
      fd = fs.openSync(this._filePath, "r");
      fs.readSync(fd, buf, 0, bytesToRead, this._offset);
      fs.closeSync(fd);
    } catch {
      if (fd !== undefined) try { fs.closeSync(fd); } catch {}
      return;
    }

    this._offset = stats.size;
    const chunk = this._buffer + buf.toString("utf8");
    const lines = chunk.split("\n");

    // Last element may be partial — keep it in the buffer
    this._buffer = lines.pop() || "";

    const parsedLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        parsedLines.push(JSON.parse(trimmed));
      } catch {
        // Not valid JSON — skip silently
      }
    }

    if (parsedLines.length > 0) {
      this._onLines(parsedLines);
    }
  }

  // Read entire file for final metrics computation
  readFull() {
    try {
      const content = fs.readFileSync(this._filePath, "utf8");
      const lines = content.split("\n");
      const parsed = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          parsed.push(JSON.parse(trimmed));
        } catch {}
      }
      return parsed;
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// WatcherManager — manages active watchers
// ---------------------------------------------------------------------------

// Active watchers: Map<"sessionId:agentName", WatcherEntry>
const watchers = new Map();

const makeKey = (sessionId, agentName) => `${sessionId}:${agentName}`;

const resolveProfile = (profileName) => {
  if (!profileName) return null;
  try {
    const profiles = getProfiles();
    return profiles.find(p => p.id === profileName || p.name === profileName) || null;
  } catch {
    return null;
  }
};

export const watchAgent = ({ sessionId, jsonlPath, agentName, missionId, taskId, profile }) => {
  const key = makeKey(sessionId, agentName);
  if (watchers.has(key)) {
    return { error: "already_watching", message: `Already watching ${key}` };
  }

  // Resolve agent profile
  const resolvedProfile = resolveProfile(profile);
  const agentProfile = {
    name: agentName,
    role: resolvedProfile?.role || profile || "",
  };

  const engine = new ObserverEngine({ agentProfile });

  // Format validation counters
  let totalEvents = 0;
  let unknownEvents = 0;
  let formatDriftWarned = false;
  let lastEventAt = null;

  const tailer = new FileTailer(jsonlPath, (events) => {
    lastEventAt = new Date().toISOString();
    for (const event of events) {
      totalEvents++;

      // Format validation
      const eventType = event.type || "unknown";
      if (!KNOWN_EVENT_TYPES.has(eventType)) {
        unknownEvents++;
        if (!formatDriftWarned && totalEvents >= 10 && unknownEvents / totalEvents > FORMAT_DRIFT_THRESHOLD) {
          formatDriftWarned = true;
          broadcastEvent("format-drift", {
            sessionId,
            agentName,
            unknownRatio: Math.round((unknownEvents / totalEvents) * 100),
            totalEvents,
            unknownEvents,
            ts: new Date().toISOString(),
          });
          console.log(`[observer] format drift warning for ${key}: ${unknownEvents}/${totalEvents} unknown events`);
        }
      }

      // Process through engine
      const violations = engine.processEvent(event);

      // Persist and broadcast violations
      for (const v of violations) {
        // In passive mode, force severity to warning
        if (observerConfig.mode === "passive") {
          v.severity = "warning";
        }
        v.mode = observerConfig.mode;

        // Persist to DB
        try {
          createViolation({
            agentName: v.agentName,
            sessionId,
            missionId: missionId || null,
            taskId: taskId || null,
            violationType: v.type,
            details: v.details,
            severity: v.severity,
          });
        } catch (err) {
          console.error(`[observer] failed to persist violation: ${err.message}`);
        }

        // Broadcast via SSE
        broadcastEvent("agent-violation", {
          ...v,
          sessionId,
          missionId: missionId || null,
          taskId: taskId || null,
          mode: observerConfig.mode,
          ts: v.timestamp,
        });

        console.log(`[observer] violation: ${v.type} for ${v.agentName} (${v.severity})`);
      }
    }
  });

  tailer.start();

  const entry = {
    sessionId,
    agentName,
    jsonlPath,
    missionId: missionId || null,
    taskId: taskId || null,
    profile: agentProfile,
    engine,
    tailer,
    startedAt: new Date().toISOString(),
    totalEvents: () => totalEvents,
    unknownEvents: () => unknownEvents,
    lastEventAt: () => lastEventAt,
  };

  watchers.set(key, entry);
  console.log(`[observer] watching ${key} — ${jsonlPath}`);

  return {
    sessionId,
    agentName,
    jsonlPath,
    missionId: missionId || null,
    taskId: taskId || null,
    profile: agentProfile,
    startedAt: entry.startedAt,
  };
};

export const unwatchAgent = (sessionId, agentName) => {
  const key = makeKey(sessionId, agentName);
  const entry = watchers.get(key);
  if (!entry) return null;

  // Stop tailing
  entry.tailer.stop();

  // Compute final metrics + violations from the full log
  const fullEngine = new ObserverEngine({ agentProfile: entry.profile });
  const allEvents = entry.tailer.readFull();
  for (const event of allEvents) {
    fullEngine.processEvent(event);
  }
  const metrics = fullEngine.getMetrics();
  const finalViolations = fullEngine.getViolations();

  // Persist violations that the live tailer may have missed
  if (finalViolations.length > 0) {
    for (const v of finalViolations) {
      if (observerConfig.mode === "passive") v.severity = "warning";
      try {
        createViolation({
          agentName: v.agentName,
          sessionId: entry.sessionId,
          missionId: entry.missionId || null,
          taskId: entry.taskId || null,
          violationType: v.type,
          details: v.details,
          severity: v.severity,
        });
      } catch (err) {
        // Skip duplicates silently
      }
    }
    console.log(`[observer] persisted ${finalViolations.length} violations from full read for ${key}`);
  }

  // Resolve parent session for subagents (so metrics join to the sessions table)
  const parentSessionId = extractParentSessionFromPath(entry.jsonlPath) || entry.sessionId;

  // Persist final metrics to DB
  let savedMetrics = null;
  try {
    savedMetrics = createAgentMetrics({
      agentName: entry.agentName,
      sessionId: parentSessionId,
      missionId: entry.missionId,
      taskId: entry.taskId,
      toolCalls: metrics.toolCalls,
      totalCalls: metrics.totalCalls,
      firstWriteAt: metrics.firstWriteAt,
      commitCount: metrics.commitCount,
      testRunCount: metrics.testRunCount,
      testPassCount: metrics.testPassCount,
      testFailCount: metrics.testFailCount,
      violationCount: metrics.violationCount,
      durationMs: metrics.durationMs,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
    });
  } catch (err) {
    console.error(`[observer] failed to persist agent metrics: ${err.message}`);
    savedMetrics = metrics;
  }

  watchers.delete(key);
  console.log(`[observer] unwatched ${key} — final metrics persisted`);

  return { metrics: savedMetrics };
};

export const getActiveWatchers = () => {
  const result = [];
  for (const [key, entry] of watchers) {
    result.push({
      key,
      sessionId: entry.sessionId,
      agentName: entry.agentName,
      jsonlPath: entry.jsonlPath,
      missionId: entry.missionId,
      taskId: entry.taskId,
      profile: entry.profile,
      startedAt: entry.startedAt,
      currentMetrics: entry.engine.getMetrics(),
      totalEvents: entry.totalEvents(),
      unknownEvents: entry.unknownEvents(),
      lastEventAt: entry.lastEventAt(),
    });
  }
  return result;
};

/** Extract parent session UUID from a JSONL path.
 *  Subagents: .../<uuid>/subagents/<agent-id>.jsonl → uuid
 *  Main agents: .../<uuid>.jsonl → uuid */
const extractParentSessionFromPath = (jsonlPath) => {
  const normalized = jsonlPath.replace(/\\/g, "/");
  const subMatch = normalized.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/subagents\//);
  if (subMatch) return subMatch[1];
  const mainMatch = normalized.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/);
  if (mainMatch) return mainMatch[1];
  return null;
};

export const unwatchAllForSession = (sessionId) => {
  const results = [];
  const toUnwatch = [];
  for (const [key, entry] of watchers) {
    // Match by direct session ID OR by parent session in JSONL path
    const parentSession = extractParentSessionFromPath(entry.jsonlPath);
    if (entry.sessionId === sessionId || parentSession === sessionId) {
      toUnwatch.push({ sessionId: entry.sessionId, agentName: entry.agentName });
    }
  }
  for (const { sessionId: sid, agentName } of toUnwatch) {
    const result = unwatchAgent(sid, agentName);
    results.push({ agentName, ...result });
  }
  return results;
};

export const cleanup = () => {
  const keys = [...watchers.keys()];
  for (const key of keys) {
    const entry = watchers.get(key);
    if (entry) {
      try {
        unwatchAgent(entry.sessionId, entry.agentName);
      } catch (err) {
        entry.tailer.stop();
        watchers.delete(key);
      }
    }
  }
  watchers.clear();
  console.log("[observer] all watchers cleaned up");
};
