// observer/watcher.js — JSONL file tailing + observer engine management
// Uses polling (not fs.watch) for Windows reliability.

import fs from "fs";
import { ObserverEngine } from "./engine.js";
import { createViolation, createAgentMetrics, getProfiles, updateTask } from "../db-store.js";
import { broadcastEvent } from "../broadcast.js";

const POLL_INTERVAL_MS = 2500; // 2.5 seconds
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds — check for stuck agents
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

  // Resolve parent session early so violations use the same session ID as metrics
  const parentSessionId = extractParentSessionFromPath(jsonlPath) || sessionId;

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

        // Persist to DB (use parentSessionId so violations join to metrics)
        try {
          createViolation({
            agentName: v.agentName,
            sessionId: parentSessionId,
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
  if (watchers.size === 1) startHeartbeat();
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

  // Resolve parent session so violations + metrics use the same session ID
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

  activeStuckPeriods.delete(key);
  watchers.delete(key);
  if (watchers.size === 0) stopHeartbeat();
  console.log(`[observer] unwatched ${key} — final metrics persisted`);

  return { metrics: savedMetrics };
};

export const STALE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes — matches frontend LIVE_WINDOW_MS

export const getActiveWatchers = () => {
  const result = [];
  const stale = [];
  const cutoff = Date.now() - STALE_WINDOW_MS;

  for (const [key, entry] of watchers) {
    const lastEvent = entry.lastEventAt();
    const lastActivity = lastEvent ? new Date(lastEvent).getTime()
      : new Date(entry.startedAt).getTime();
    if (lastActivity < cutoff) {
      stale.push({ sessionId: entry.sessionId, agentName: entry.agentName });
      continue;
    }
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
      lastEventAt: lastEvent,
    });
  }

  // Clean up stale watchers outside the iteration
  for (const { sessionId, agentName } of stale) {
    unwatchAgent(sessionId, agentName);
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
  stopHeartbeat();
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

// ---------------------------------------------------------------------------
// Heartbeat — real-time stuck detection (fires while agent is silent)
// ---------------------------------------------------------------------------

// Track which agents have an active stuck period to avoid duplicate violations
const activeStuckPeriods = new Map(); // key → timestamp of stuck start

let heartbeatTimer = null;

const startHeartbeat = () => {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => checkStuckAgents(), HEARTBEAT_INTERVAL_MS);
  console.log("[observer] heartbeat started");
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log("[observer] heartbeat stopped");
  }
};

const checkStuckAgents = () => {
  for (const [key, entry] of watchers) {
    const silenceMs = entry.engine.getSilenceMs();
    const thresholdSec = entry.engine.getStuckThreshold();
    if (silenceMs === null || thresholdSec === null) continue;

    const silenceSec = silenceMs / 1000;
    if (silenceSec < thresholdSec) {
      // Agent is active — clear any previous stuck period
      activeStuckPeriods.delete(key);
      continue;
    }

    // Agent is stuck — check if we already fired for this stuck period
    if (activeStuckPeriods.has(key)) continue;
    activeStuckPeriods.set(key, Date.now());

    const severity = observerConfig.mode === "passive" ? "warning" : "critical";
    const details = { silenceSeconds: Math.round(silenceSec), threshold: thresholdSec, source: "heartbeat" };

    // Persist violation (use parent session so violations join to metrics)
    const stuckParentSession = extractParentSessionFromPath(entry.jsonlPath) || entry.sessionId;
    try {
      createViolation({
        agentName: entry.agentName,
        sessionId: stuckParentSession,
        missionId: entry.missionId || null,
        taskId: entry.taskId || null,
        violationType: "stuck",
        details,
        severity,
      });
    } catch (err) {
      console.error(`[observer] heartbeat: failed to persist stuck violation: ${err.message}`);
    }

    // Broadcast
    broadcastEvent("agent-stuck", {
      agentName: entry.agentName,
      sessionId: entry.sessionId,
      missionId: entry.missionId || null,
      taskId: entry.taskId || null,
      silenceSeconds: Math.round(silenceSec),
      threshold: thresholdSec,
      mode: observerConfig.mode,
      ts: new Date().toISOString(),
    });

    // Auto-block mission task if assigned
    if (entry.missionId && entry.taskId) {
      try {
        updateTask(entry.missionId, entry.taskId, {
          status: "blocked",
          blockers: [`Agent ${entry.agentName} stuck for ${Math.round(silenceSec)}s (threshold: ${thresholdSec}s)`],
        });
        console.log(`[observer] heartbeat: auto-blocked task ${entry.taskId} — agent ${entry.agentName} stuck`);
      } catch (err) {
        console.error(`[observer] heartbeat: failed to auto-block task: ${err.message}`);
      }
    }

    console.log(`[observer] heartbeat: ${entry.agentName} stuck for ${Math.round(silenceSec)}s (threshold: ${thresholdSec}s)`);
  }
};

/** Returns list of currently-stuck agents for the orchestrator. */
export const getStuckAgents = () => {
  const stuck = [];
  for (const [key, entry] of watchers) {
    const silenceMs = entry.engine.getSilenceMs();
    const thresholdSec = entry.engine.getStuckThreshold();
    if (silenceMs === null || thresholdSec === null) continue;

    const silenceSec = silenceMs / 1000;
    if (silenceSec >= thresholdSec) {
      stuck.push({
        agentName: entry.agentName,
        sessionId: entry.sessionId,
        missionId: entry.missionId || null,
        taskId: entry.taskId || null,
        silenceSeconds: Math.round(silenceSec),
        threshold: thresholdSec,
        profile: entry.profile,
        startedAt: entry.startedAt,
        autoBlocked: activeStuckPeriods.has(key),
      });
    }
  }
  return stuck;
};
