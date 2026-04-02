// routes/orchestration.js — orchestration audit and scorecard

import { Router } from "express";
import { getDb } from "../db.js";
import {
  getSessionById,
  getAgentResults,
} from "../db-store.js";

const router = Router();

// Weights for scorecard (total = 100)
const WEIGHTS = {
  brainQueriedBeforeTasks: 20,
  profilesInjected: 20,
  decisionsRecorded: 15,
  experimentsObserved: 10,
  missionTasksUpdated: 20,
  reviewerRunAfterChanges: 15,
};

/**
 * Gather audit data for a session by checking activity_log, mission_tasks,
 * agent_results, decisions, and experiments.
 */
const auditSession = (sessionId) => {
  const db = getDb();
  const findings = [];

  // 1. Brain queried before tasks — check activity_log for memory reads before task starts
  const logEntries = db.prepare(
    "SELECT * FROM activity_log WHERE session_id = ? ORDER BY timestamp ASC"
  ).all(sessionId);

  const tasksStarted = db.prepare(
    "SELECT * FROM mission_tasks WHERE session_id = ? AND started_at IS NOT NULL ORDER BY started_at ASC"
  ).all(sessionId);

  const brainReads = logEntries.filter(e => e.action === "read" || e.action === "search" || e.action === "context");
  const firstTaskStart = tasksStarted.length > 0 ? tasksStarted[0].started_at : null;
  const brainQueriedBeforeFirstTask = firstTaskStart
    ? brainReads.some(r => r.timestamp < firstTaskStart)
    : brainReads.length > 0;

  if (!brainQueriedBeforeFirstTask && tasksStarted.length > 0) {
    findings.push({ check: "brainQueriedBeforeTasks", passed: false, detail: "No brain query found before first task started" });
  } else {
    findings.push({ check: "brainQueriedBeforeTasks", passed: true, detail: brainReads.length > 0 ? `${brainReads.length} brain queries found` : "No tasks started" });
  }

  // 2. Profiles injected into subagents — check agent_results for agents spawned this session
  const agentResults = getAgentResults({ sessionId });
  const agentsUsed = agentResults.length;
  // Heuristic: if agents were spawned, we expect activity_log entries with "profile" context
  const profileLogs = logEntries.filter(e => e.value_summary && e.value_summary.includes("profile"));
  const profilesInjected = agentsUsed === 0 || profileLogs.length > 0;

  findings.push({
    check: "profilesInjected",
    passed: profilesInjected,
    detail: agentsUsed === 0
      ? "No agents spawned"
      : profileLogs.length > 0
        ? `${profileLogs.length} profile injection(s) for ${agentsUsed} agent(s)`
        : `${agentsUsed} agent(s) spawned but no profile injection detected`,
  });

  // 3. Decisions recorded — check if any decisions were added this session
  const sessionDecisions = db.prepare(
    "SELECT COUNT(*) as cnt FROM decisions WHERE session_id = ?"
  ).get(sessionId).cnt;

  const sessionEntries = db.prepare(
    "SELECT COUNT(*) as cnt FROM entries WHERE session_id = ?"
  ).get(sessionId).cnt;

  // If significant work happened (entries written) but no decisions recorded, flag it
  const significantWork = sessionEntries >= 3 || tasksStarted.length >= 2;
  const decisionsRecorded = sessionDecisions > 0 || !significantWork;

  findings.push({
    check: "decisionsRecorded",
    passed: decisionsRecorded,
    detail: sessionDecisions > 0
      ? `${sessionDecisions} decision(s) recorded`
      : significantWork
        ? "Significant work done but no decisions recorded"
        : "Light session — no decisions expected",
  });

  // 4. Experiments observed — if active experiments exist, were observations added?
  const activeExperiments = db.prepare("SELECT COUNT(*) as cnt FROM experiments WHERE status = 'active'").get().cnt;
  const sessionObservations = db.prepare(
    "SELECT COUNT(*) as cnt FROM observations WHERE session_id = ?"
  ).get(sessionId).cnt;

  const experimentsObserved = activeExperiments === 0 || sessionObservations > 0 || !significantWork;

  findings.push({
    check: "experimentsObserved",
    passed: experimentsObserved,
    detail: activeExperiments === 0
      ? "No active experiments"
      : sessionObservations > 0
        ? `${sessionObservations} observation(s) for ${activeExperiments} active experiment(s)`
        : "Active experiments exist but no observations recorded",
  });

  // 5. Mission tasks updated — if a mission was active, were tasks progressed?
  const missionTasksForSession = db.prepare(
    "SELECT COUNT(*) as cnt FROM mission_tasks WHERE session_id = ?"
  ).get(sessionId).cnt;

  const tasksCompleted = db.prepare(
    "SELECT COUNT(*) as cnt FROM mission_tasks WHERE session_id = ? AND status = 'completed'"
  ).get(sessionId).cnt;

  findings.push({
    check: "missionTasksUpdated",
    passed: missionTasksForSession > 0 || !significantWork,
    detail: missionTasksForSession > 0
      ? `${missionTasksForSession} task(s) touched, ${tasksCompleted} completed`
      : significantWork
        ? "Work done but no mission tasks updated"
        : "Light session",
  });

  // 6. Reviewer run after changes — check if agent results include a reviewer agent
  const reviewerRun = agentResults.some(r => /review/i.test(r.agent));
  const codeChanged = agentResults.some(r => r.changedFiles && r.changedFiles.length > 0);

  findings.push({
    check: "reviewerRunAfterChanges",
    passed: reviewerRun || !codeChanged,
    detail: !codeChanged
      ? "No code changes detected"
      : reviewerRun
        ? "Reviewer agent was run"
        : "Code changed but no reviewer agent detected",
  });

  return findings;
};

// GET /orchestration/audit?session=X — what the agent should have done but didn't
router.get("/audit", (req, res) => {
  const sessionId = req.query.session;
  if (!sessionId) return res.status(400).json({ error: "Missing session query parameter" });

  const session = getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const findings = auditSession(sessionId);
  const violations = findings.filter(f => !f.passed);

  res.json({
    sessionId,
    label: session.label || null,
    project: session.project || null,
    totalChecks: findings.length,
    passed: findings.filter(f => f.passed).length,
    failed: violations.length,
    findings,
  });
});

// GET /orchestration/score?session=X — 0-100 score based on audit
router.get("/score", (req, res) => {
  const sessionId = req.query.session;
  if (!sessionId) return res.status(400).json({ error: "Missing session query parameter" });

  const session = getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const findings = auditSession(sessionId);

  let score = 0;
  const breakdown = {};
  for (const f of findings) {
    const weight = WEIGHTS[f.check] || 0;
    const earned = f.passed ? weight : 0;
    score += earned;
    breakdown[f.check] = { weight, earned, passed: f.passed, detail: f.detail };
  }

  res.json({
    sessionId,
    label: session.label || null,
    project: session.project || null,
    score,
    maxScore: 100,
    breakdown,
  });
});

export default router;
