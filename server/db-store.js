// db-store.js — SQLite data access layer (replaces brain-store.js)

import fs from "fs";
import path from "path";
import os from "os";
import { getDb } from "./db.js";
import { slugify, tokenize, similarity } from "./text-utils.js";
import { detectSection, normalizeProject, entryText, getEntryProjects, filterByProject } from "./entry-utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseJson = (val, fallback = []) => {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
};

const jsonStr = (val) => JSON.stringify(val ?? []);

const now = () => new Date().toISOString();

// Parse an entries row into the object shape routes expect.
const rowToEntry = (row) => ({
  text: row.text,
  confidence: row.confidence || "tentative",
  source: row.source || "unknown",
  sessionId: row.session_id || null,
  project: parseJson(row.project, ["general"]),
  tags: parseJson(row.tags, []),
  createdAt: row.created_at || null,
  lastTouched: row.last_touched || null,
  annotations: parseJson(row.annotations, []),
  history: parseJson(row.history, []),
});

const rowToDecision = (row) => ({
  decision: row.decision,
  status: row.status || "open",
  confidence: row.confidence || "tentative",
  source: row.source || "unknown",
  sessionId: row.session_id || null,
  project: parseJson(row.project, ["general"]),
  createdAt: row.created_at || null,
  lastTouched: row.last_touched || null,
  annotations: parseJson(row.annotations, []),
  history: parseJson(row.history, []),
});

const rowToMission = (row) => ({
  id: row.id,
  name: row.name,
  project: row.project || null,
  status: row.status || "active",
  createdAt: row.created_at || null,
  createdInSession: row.session_id || null,
  completedAt: row.completed_at || null,
});

const rowToTask = (row) => ({
  id: row.id,
  description: row.description,
  status: row.status || "pending",
  assignedAgent: row.assigned_agent || null,
  sessionId: row.session_id || null,
  output: row.output || null,
  blockers: parseJson(row.blockers, []),
  createdAt: row.created_at || null,
  startedAt: row.started_at || null,
  completedAt: row.completed_at || null,
});

const rowToReminder = (row) => ({
  id: row.id,
  text: row.text,
  status: row.status || "pending",
  priority: row.priority || "normal",
  dueDate: row.due_date || null,
  project: parseJson(row.project, ["general"]),
  createdAt: row.created_at || null,
  completedAt: row.completed_at || null,
  snoozedUntil: row.snoozed_until || null,
});

const rowToExperiment = (row) => ({
  id: row.id,
  name: row.name,
  hypothesis: row.hypothesis,
  status: row.status || "active",
  conclusion: row.conclusion || null,
  project: parseJson(row.project, ["general"]),
  sessionId: row.session_id || null,
  createdAt: row.created_at || null,
  concludedAt: row.concluded_at || null,
});

const rowToObservation = (row) => ({
  id: row.id,
  text: row.text,
  sentiment: row.sentiment || "neutral",
  sessionId: row.session_id || null,
  source: row.source || "claude-session",
  createdAt: row.created_at || null,
});

const rowToProfile = (row) => ({
  id: row.id,
  name: row.name,
  taskType: row.task_type || "",
  project: row.project || null,
  sections: parseJson(row.sections, ["workingStyle", "architecture", "agentRules", "decisions"]),
  tags: parseJson(row.tags, []),
  model: row.model || "",
  role: row.role || "",
  systemPrompt: row.system_prompt || "",
  constraints: parseJson(row.constraints, []),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const rowToProject = (row) => ({
  id: row.id,
  name: row.name,
  repos: parseJson(row.repos, []),
  status: row.status || "active",
});

const rowToWebhook = (row) => ({
  url: row.url,
  events: parseJson(row.events, []),
});

const rowToLogEntry = (row) => ({
  ts: row.timestamp,
  action: row.action,
  section: row.section,
  source: row.source || "unknown",
  sessionId: row.session_id || null,
  value: row.value_summary || null,
});

const rowToArchived = (row) => {
  const base = {
    section: row.section,
    confidence: row.confidence || "tentative",
    source: row.source || "unknown",
    sessionId: row.session_id || null,
    project: parseJson(row.project, ["general"]),
    annotations: parseJson(row.annotations, []),
    history: parseJson(row.history, []),
    createdAt: row.created_at || null,
    lastTouched: row.last_touched || null,
    archivedAt: row.archived_at || null,
  };
  if (row.section === "decisions") {
    base.decision = row.decision || row.text || "";
    base.status = row.status || "open";
  } else {
    base.text = row.text || "";
  }
  return base;
};

// Check whether a project array (JSON-stored) includes a given projectId.
// Uses SQLite JSON functions when available, but we often just load and filter in JS.
const projectMatchesSql = (colName, projectId) =>
  `json_each.value = ?`;

// Build a WHERE clause fragment for project filtering on a JSON array column.
// Returns { clause, params } to be spliced into a query.
const projectFilter = (colName, projectId) => {
  if (!projectId) return { clause: "", join: "", params: [] };
  return {
    join: `, json_each(${colName}) AS je`,
    clause: `AND je.value = ?`,
    params: [projectId],
  };
};

// ---------------------------------------------------------------------------
// Entry CRUD (workingStyle, architecture, agentRules)
// ---------------------------------------------------------------------------

export const getEntries = (section, projectId) => {
  const db = getDb();
  let rows;
  if (projectId) {
    rows = db.prepare(`
      SELECT DISTINCT e.* FROM entries e, json_each(e.project) AS je
      WHERE e.section = ? AND je.value = ?
      ORDER BY e.created_at
    `).all(section, projectId);
  } else {
    rows = db.prepare("SELECT * FROM entries WHERE section = ? ORDER BY created_at").all(section);
  }
  return rows.map(rowToEntry);
};

export const addEntry = (section, text, { confidence, source, sessionId, project } = {}) => {
  const db = getDb();
  const ts = now();
  const proj = jsonStr(normalizeProject(project));
  // Check duplicate
  const existing = db.prepare("SELECT id FROM entries WHERE section = ? AND text = ?").get(section, text);
  if (existing) return;
  db.prepare(`
    INSERT INTO entries (section, text, confidence, source, session_id, project, created_at, last_touched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(section, text, confidence || "tentative", source || "unknown", sessionId || null, proj, ts, ts);
};

export const removeEntry = (section, text) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM entries WHERE section = ? AND text = ?").run(section, text);
  return result.changes > 0;
};

export const updateEntry = (section, oldText, newText, { source, sessionId, confidence, project } = {}) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM entries WHERE section = ? AND text = ?").get(section, oldText);
  if (!row) return false;

  const ts = now();
  const history = parseJson(row.history, []);
  history.push({ text: oldText, changedAt: ts, changedBy: source || "unknown" });

  const proj = project ? jsonStr(normalizeProject(project)) : row.project;
  db.prepare(`
    UPDATE entries SET text = ?, confidence = ?, source = ?, session_id = ?, project = ?,
      history = ?, last_touched = ?
    WHERE section = ? AND id = ?
  `).run(
    newText,
    confidence || row.confidence,
    source || row.source,
    sessionId || row.session_id,
    proj,
    jsonStr(history),
    ts,
    section,
    row.id,
  );
  return true;
};

export const updateConfidence = (section, text, confidence) => {
  const db = getDb();
  const ts = now();
  const result = db.prepare("UPDATE entries SET confidence = ?, last_touched = ? WHERE section = ? AND text = ?")
    .run(confidence, ts, section, text);
  return result.changes > 0;
};

export const retagEntry = (section, text, { project, addProject, removeProject }) => {
  const db = getDb();
  const ts = now();

  if (section === "decisions") {
    const row = db.prepare("SELECT * FROM decisions WHERE decision = ?").get(text);
    if (!row) return { ok: false, error: "Entry not found" };
    const current = parseJson(row.project, ["general"]);
    const newProj = computeNewProject(current, { project, addProject, removeProject });
    if (newProj === null) return { ok: false, error: "Cannot remove the last project tag from an entry" };
    db.prepare("UPDATE decisions SET project = ?, last_touched = ? WHERE id = ?")
      .run(jsonStr(newProj), ts, row.id);
    return { ok: true };
  }

  const row = db.prepare("SELECT * FROM entries WHERE section = ? AND text = ?").get(section, text);
  if (!row) return { ok: false, error: "Entry not found" };
  const current = parseJson(row.project, ["general"]);
  const newProj = computeNewProject(current, { project, addProject, removeProject });
  if (newProj === null) return { ok: false, error: "Cannot remove the last project tag from an entry" };
  db.prepare("UPDATE entries SET project = ?, last_touched = ? WHERE id = ?")
    .run(jsonStr(newProj), ts, row.id);
  return { ok: true };
};

const computeNewProject = (current, { project, addProject, removeProject }) => {
  if (addProject) {
    if (!current.includes(addProject)) current.push(addProject);
    return current;
  }
  if (removeProject) {
    if (current.length <= 1) return null;
    return current.filter(p => p !== removeProject);
  }
  return normalizeProject(project);
};

// ---------------------------------------------------------------------------
// Decision CRUD
// ---------------------------------------------------------------------------

export const getDecisions = (projectId) => {
  const db = getDb();
  let rows;
  if (projectId) {
    rows = db.prepare(`
      SELECT DISTINCT d.* FROM decisions d, json_each(d.project) AS je
      WHERE je.value = ?
      ORDER BY d.created_at
    `).all(projectId);
  } else {
    rows = db.prepare("SELECT * FROM decisions ORDER BY created_at").all();
  }
  return rows.map(rowToDecision);
};

export const addDecision = (entry) => {
  const db = getDb();
  const ts = now();
  const proj = jsonStr(normalizeProject(entry.project));
  const existing = db.prepare("SELECT id FROM decisions WHERE decision = ?").get(entry.decision);
  if (existing) return;
  db.prepare(`
    INSERT INTO decisions (decision, status, confidence, source, session_id, project, created_at, last_touched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.decision,
    entry.status || "open",
    entry.confidence || "tentative",
    entry.source || "unknown",
    entry.sessionId || null,
    proj,
    entry.createdAt || ts,
    ts,
  );
};

export const resolveDecision = (decisionText) => {
  const db = getDb();
  const ts = now();
  const result = db.prepare("UPDATE decisions SET status = 'resolved', last_touched = ? WHERE decision = ?")
    .run(ts, decisionText);
  return result.changes > 0;
};

export const updateDecision = (decisionText, updates, source) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM decisions WHERE decision = ?").get(decisionText);
  if (!row) return false;

  const ts = now();
  const history = parseJson(row.history, []);
  history.push({ text: row.decision, changedAt: ts, changedBy: source || "unknown" });

  // Merge updates — only apply fields that are provided
  const newDecision = updates.decision !== undefined ? updates.decision : row.decision;
  const newStatus = updates.status !== undefined ? updates.status : row.status;
  const newConfidence = updates.confidence !== undefined ? updates.confidence : row.confidence;
  const newProject = updates.project ? jsonStr(normalizeProject(updates.project)) : row.project;

  db.prepare(`
    UPDATE decisions SET decision = ?, status = ?, confidence = ?, source = ?,
      session_id = ?, project = ?, history = ?, last_touched = ?
    WHERE id = ?
  `).run(
    newDecision,
    newStatus,
    newConfidence,
    source || row.source,
    updates.sessionId || row.session_id,
    newProject,
    jsonStr(history),
    ts,
    row.id,
  );
  return true;
};

export const updateDecisionConfidence = (text, confidence) => {
  const db = getDb();
  const ts = now();
  const result = db.prepare("UPDATE decisions SET confidence = ?, last_touched = ? WHERE decision = ?")
    .run(confidence, ts, text);
  return result.changes > 0;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const searchEntries = (query, projectId) => {
  const terms = query.toLowerCase().trim().split(/\s+/);
  const results = [];

  // Search entries
  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    const entries = getEntries(section, projectId);
    for (const entry of entries) {
      const text = entry.text.toLowerCase();
      if (terms.every(t => text.includes(t))) {
        results.push({ section, entry });
      }
    }
  }

  // Search decisions
  const decisions = getDecisions(projectId);
  for (const d of decisions) {
    const text = (d.decision || "").toLowerCase();
    if (terms.every(t => text.includes(t))) {
      results.push({ section: "decisions", entry: d });
    }
  }

  // Search experiments
  const experiments = getExperimentsInternal(null, projectId);
  for (const exp of experiments) {
    const searchable = `${exp.name} ${exp.hypothesis} ${(exp.observations || []).map(o => o.text).join(" ")}`.toLowerCase();
    if (terms.every(t => searchable.includes(t))) {
      results.push({ section: "experiments", entry: exp });
    }
  }

  return { query: query.toLowerCase().trim(), count: results.length, results };
};

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export const createMission = ({ name, project, sessionId, tasks }) => {
  const db = getDb();
  const ts = now();

  const existingIds = new Set(db.prepare("SELECT id FROM missions").all().map(r => r.id));
  const missionId = slugify(name, "m", existingIds);

  const existingTaskIds = new Set(db.prepare("SELECT id FROM mission_tasks").all().map(r => r.id));

  const insertMission = db.prepare(`
    INSERT INTO missions (id, name, project, status, session_id, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO mission_tasks (id, mission_id, description, status, blockers, created_at)
    VALUES (?, ?, ?, 'pending', '[]', ?)
  `);

  const missionTasks = [];
  const doCreate = db.transaction(() => {
    insertMission.run(missionId, name, project || null, sessionId || null, ts);
    for (const t of (tasks || [])) {
      const taskId = slugify(t.description, "t", existingTaskIds);
      existingTaskIds.add(taskId);
      insertTask.run(taskId, missionId, t.description, ts);
      missionTasks.push({
        id: taskId,
        description: t.description,
        status: "pending",
        assignedAgent: null,
        sessionId: null,
        output: null,
        blockers: [],
        createdAt: ts,
        startedAt: null,
        completedAt: null,
      });
    }
  });
  doCreate();

  return {
    id: missionId,
    name,
    project: project || null,
    status: "active",
    createdAt: ts,
    createdInSession: sessionId || null,
    completedAt: null,
    tasks: missionTasks,
  };
};

export const getMissions = (statusFilter, projectFilter) => {
  const db = getDb();
  let sql = "SELECT * FROM missions WHERE 1=1";
  const params = [];
  if (statusFilter) { sql += " AND status = ?"; params.push(statusFilter); }
  if (projectFilter) { sql += " AND project = ?"; params.push(projectFilter); }
  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params);
  return rows.map(row => {
    const m = rowToMission(row);
    const tasks = db.prepare("SELECT * FROM mission_tasks WHERE mission_id = ?").all(row.id);
    const counts = { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
    for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
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
};

export const getMission = (id) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM missions WHERE id = ?").get(id);
  if (!row) return null;
  const m = rowToMission(row);
  const taskRows = db.prepare("SELECT * FROM mission_tasks WHERE mission_id = ? ORDER BY created_at").all(id);
  m.tasks = taskRows.map(rowToTask);
  return m;
};

export const updateMission = (id, { name, status, project }) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM missions WHERE id = ?").get(id);
  if (!row) return null;

  const ts = now();
  const newName = name !== undefined ? name : row.name;
  const newProject = project !== undefined ? project : row.project;
  let newStatus = status !== undefined ? status : row.status;
  let completedAt = row.completed_at;

  if (status !== undefined) {
    if ((status === "completed" || status === "abandoned") && !completedAt) completedAt = ts;
    if (status === "active") completedAt = null;
  }

  db.prepare(`
    UPDATE missions SET name = ?, project = ?, status = ?, completed_at = ? WHERE id = ?
  `).run(newName, newProject, newStatus, completedAt, id);

  return getMission(id);
};

export const deleteMission = (id) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM missions WHERE id = ?").run(id);
  return result.changes > 0;
};

export const addTasksToMission = (missionId, tasks) => {
  const db = getDb();
  const mission = db.prepare("SELECT * FROM missions WHERE id = ?").get(missionId);
  if (!mission) return null;

  const ts = now();
  const existingTaskIds = new Set(db.prepare("SELECT id FROM mission_tasks").all().map(r => r.id));

  const insertTask = db.prepare(`
    INSERT INTO mission_tasks (id, mission_id, description, status, blockers, created_at)
    VALUES (?, ?, ?, 'pending', '[]', ?)
  `);

  const newTasks = [];
  const doAdd = db.transaction(() => {
    for (const t of tasks) {
      const taskId = slugify(t.description, "t", existingTaskIds);
      existingTaskIds.add(taskId);
      insertTask.run(taskId, missionId, t.description, ts);
      newTasks.push({
        id: taskId,
        description: t.description,
        status: "pending",
        assignedAgent: null,
        sessionId: null,
        output: null,
        blockers: [],
        createdAt: ts,
        startedAt: null,
        completedAt: null,
      });
    }

    // Reopen closed missions when new tasks are added
    if (mission.status !== "active") {
      db.prepare("UPDATE missions SET status = 'active', completed_at = NULL WHERE id = ?").run(missionId);
    }
  });
  doAdd();

  return newTasks;
};

export const updateTask = (missionId, taskId, updates) => {
  const db = getDb();
  const mission = db.prepare("SELECT * FROM missions WHERE id = ?").get(missionId);
  if (!mission) return { task: null, missionAutoCompleted: false };

  const taskRow = db.prepare("SELECT * FROM mission_tasks WHERE id = ? AND mission_id = ?").get(taskId, missionId);
  if (!taskRow) return { task: null, missionAutoCompleted: false };

  const ts = now();
  const { status, assignedAgent, sessionId, output, blockers, description } = updates;

  let newDescription = description !== undefined ? description : taskRow.description;
  let newAgent = assignedAgent !== undefined ? assignedAgent : taskRow.assigned_agent;
  let newSessionId = sessionId !== undefined ? sessionId : taskRow.session_id;
  let newOutput = output !== undefined ? output : taskRow.output;
  let newBlockers = blockers !== undefined ? jsonStr(blockers) : taskRow.blockers;
  let newStatus = status !== undefined ? status : taskRow.status;
  let startedAt = taskRow.started_at;
  let completedAt = taskRow.completed_at;

  if (status !== undefined) {
    if (status === "in_progress" && !startedAt) startedAt = ts;
    if (status === "completed" && !completedAt) completedAt = ts;
  }

  db.prepare(`
    UPDATE mission_tasks SET description = ?, status = ?, assigned_agent = ?,
      session_id = ?, output = ?, blockers = ?, started_at = ?, completed_at = ?
    WHERE id = ? AND mission_id = ?
  `).run(newDescription, newStatus, newAgent, newSessionId, newOutput, newBlockers, startedAt, completedAt, taskId, missionId);

  // Check auto-complete
  let missionAutoCompleted = false;
  const allTasks = db.prepare("SELECT status FROM mission_tasks WHERE mission_id = ?").all(missionId);
  const allCompleted = allTasks.length > 0 && allTasks.every(t => t.status === "completed");
  if (allCompleted && mission.status === "active") {
    db.prepare("UPDATE missions SET status = 'completed', completed_at = ? WHERE id = ?").run(ts, missionId);
    missionAutoCompleted = true;
  }

  const updatedTask = rowToTask(db.prepare("SELECT * FROM mission_tasks WHERE id = ?").get(taskId));
  return { task: updatedTask, missionAutoCompleted };
};

export const getResumableMissions = (projectFilter) => {
  const db = getDb();
  let sql = "SELECT * FROM missions WHERE status = 'active'";
  const params = [];
  if (projectFilter) { sql += " AND project = ?"; params.push(projectFilter); }

  const missions = db.prepare(sql).all(...params);
  const results = [];

  for (const row of missions) {
    const allTasks = db.prepare("SELECT * FROM mission_tasks WHERE mission_id = ? ORDER BY created_at").all(row.id).map(rowToTask);
    const resumableTasks = allTasks.filter(t => ["pending", "in_progress", "blocked"].includes(t.status));
    if (resumableTasks.length === 0) continue;

    const counts = { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
    for (const t of allTasks) counts[t.status] = (counts[t.status] || 0) + 1;

    results.push({
      id: row.id,
      name: row.name,
      project: row.project,
      pendingTasks: counts.pending,
      inProgressTasks: counts.in_progress,
      completedTasks: counts.completed,
      blockedTasks: counts.blocked,
      tasks: resumableTasks,
    });
  }

  return { missions: results };
};

export const getAgentStats = () => {
  const db = getDb();
  const agentMap = {};

  const allMissions = db.prepare("SELECT id, name FROM missions").all();
  const missionNames = {};
  for (const m of allMissions) missionNames[m.id] = m.name;

  const tasks = db.prepare("SELECT * FROM mission_tasks WHERE assigned_agent IS NOT NULL").all();

  for (const t of tasks) {
    const name = t.assigned_agent;
    if (!agentMap[name]) {
      agentMap[name] = {
        name,
        taskCount: 0,
        completedCount: 0,
        blockedCount: 0,
        inProgressCount: 0,
        totalDurationMs: 0,
        durationTasks: 0,
        lastUsed: null,
        recentTasks: [],
      };
    }
    const a = agentMap[name];
    a.taskCount++;
    if (t.status === "completed") a.completedCount++;
    if (t.status === "blocked") a.blockedCount++;
    if (t.status === "in_progress") a.inProgressCount++;

    if (t.started_at && t.completed_at) {
      const dur = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime();
      if (dur > 0) { a.totalDurationMs += dur; a.durationTasks++; }
    }

    const taskTime = t.completed_at || t.started_at || t.created_at;
    if (taskTime && (!a.lastUsed || taskTime > a.lastUsed)) a.lastUsed = taskTime;

    a.recentTasks.push({
      id: t.id,
      description: t.description,
      status: t.status,
      output: t.output,
      missionId: t.mission_id,
      missionName: missionNames[t.mission_id] || null,
      startedAt: t.started_at,
      completedAt: t.completed_at,
    });
  }

  const result = Object.values(agentMap).map(a => ({
    ...a,
    avgDurationMs: a.durationTasks > 0 ? Math.round(a.totalDurationMs / a.durationTasks) : 0,
    recentTasks: a.recentTasks
      .sort((x, y) => (y.completedAt || y.startedAt || "").localeCompare(x.completedAt || x.startedAt || ""))
      .slice(0, 10),
  }));
  result.forEach(a => { delete a.totalDurationMs; delete a.durationTasks; });
  return result.sort((a, b) => (b.lastUsed || "").localeCompare(a.lastUsed || ""));
};

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const createReminder = ({ text, priority, dueDate, project }) => {
  const db = getDb();
  const ts = now();
  const existingIds = new Set(db.prepare("SELECT id FROM reminders").all().map(r => r.id));
  const id = slugify(text, "r", existingIds);
  const proj = jsonStr(project ? (Array.isArray(project) ? project : [project]) : ["general"]);
  const resolvedPriority = priority || "normal";

  db.prepare(`
    INSERT INTO reminders (id, text, status, priority, due_date, project, created_at)
    VALUES (?, ?, 'pending', ?, ?, ?, ?)
  `).run(id, text, resolvedPriority, dueDate || null, proj, ts);

  return {
    id,
    text,
    status: "pending",
    priority: resolvedPriority,
    dueDate: dueDate || null,
    project: project ? (Array.isArray(project) ? project : [project]) : ["general"],
    createdAt: ts,
    completedAt: null,
    snoozedUntil: null,
  };
};

export const getReminders = (statusFilter, projectFilter, dueFilter) => {
  const db = getDb();
  // Auto-unsnooze first
  applyAutoUnsnooze();

  let sql = "SELECT * FROM reminders WHERE 1=1";
  const params = [];

  if (statusFilter && statusFilter !== "all") {
    sql += " AND status = ?";
    params.push(statusFilter);
  }

  const rows = db.prepare(sql).all(...params);
  let reminders = rows.map(rowToReminder);

  if (projectFilter) {
    reminders = reminders.filter(r => (r.project || []).includes(projectFilter));
  }

  if (dueFilter === "overdue") {
    const ts = now();
    reminders = reminders.filter(r => r.dueDate && r.dueDate < ts && r.status !== "done");
  }

  return sortReminders(reminders);
};

export const updateReminder = (id, updates) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  if (!row) return null;

  const ts = now();
  const current = rowToReminder(row);

  if (updates.text !== undefined) current.text = updates.text;
  if (updates.dueDate !== undefined) current.dueDate = updates.dueDate;
  if (updates.project !== undefined) current.project = Array.isArray(updates.project) ? updates.project : [updates.project];
  if (updates.priority !== undefined) current.priority = updates.priority;

  if (updates.status !== undefined) {
    current.status = updates.status;
    if (updates.status === "done" && !current.completedAt) current.completedAt = ts;
    if (updates.status !== "done") current.completedAt = null;
    if (updates.status !== "snoozed") current.snoozedUntil = null;
    if (updates.status === "snoozed" && updates.snoozedUntil !== undefined) current.snoozedUntil = updates.snoozedUntil;
  }

  if (updates.status === undefined && updates.snoozedUntil !== undefined) {
    current.snoozedUntil = updates.snoozedUntil;
  }

  db.prepare(`
    UPDATE reminders SET text = ?, status = ?, priority = ?, due_date = ?,
      snoozed_until = ?, project = ?, completed_at = ?
    WHERE id = ?
  `).run(
    current.text, current.status, current.priority, current.dueDate,
    current.snoozedUntil, jsonStr(current.project), current.completedAt,
    id,
  );

  return current;
};

export const deleteReminder = (id) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
  return result.changes > 0;
};

export const applyAutoUnsnooze = () => {
  const db = getDb();
  const result = db.prepare(`
    UPDATE reminders SET status = 'pending', snoozed_until = NULL
    WHERE status = 'snoozed' AND snoozed_until <= datetime('now')
  `).run();
  return result.changes > 0;
};

const sortReminders = (reminders) => {
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  return [...reminders].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
};

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

// Internal helper that fetches experiments with observations joined in.
const getExperimentsInternal = (statusFilter, projectFilter) => {
  const db = getDb();
  let sql = "SELECT * FROM experiments WHERE 1=1";
  const params = [];
  if (statusFilter) { sql += " AND status = ?"; params.push(statusFilter); }
  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params);
  const experiments = rows.map(row => {
    const exp = rowToExperiment(row);
    const obsRows = db.prepare("SELECT * FROM observations WHERE experiment_id = ? ORDER BY created_at").all(row.id);
    exp.observations = obsRows.map(rowToObservation);
    return exp;
  });

  if (projectFilter) {
    return experiments.filter(e => (e.project || []).includes(projectFilter));
  }
  return experiments;
};

export const createExperiment = ({ name, hypothesis, project, sessionId }) => {
  const db = getDb();
  const ts = now();
  const existingIds = new Set(db.prepare("SELECT id FROM experiments").all().map(r => r.id));
  const id = slugify(name, "e", existingIds);
  const proj = jsonStr(project ? (Array.isArray(project) ? project : [project]) : ["general"]);

  db.prepare(`
    INSERT INTO experiments (id, name, hypothesis, status, project, session_id, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(id, name, hypothesis, proj, sessionId || null, ts);

  return {
    id,
    name,
    hypothesis,
    status: "active",
    conclusion: null,
    project: project ? (Array.isArray(project) ? project : [project]) : ["general"],
    sessionId: sessionId || null,
    createdAt: ts,
    concludedAt: null,
    observations: [],
  };
};

export const getExperiments = (statusFilter, projectFilter) => {
  const experiments = getExperimentsInternal(statusFilter, projectFilter);
  return experiments.map(e => {
    const obs = e.observations || [];
    const pos = obs.filter(o => o.sentiment === "positive").length;
    const neg = obs.filter(o => o.sentiment === "negative").length;
    const neu = obs.filter(o => o.sentiment === "neutral").length;
    return {
      id: e.id,
      name: e.name,
      hypothesis: e.hypothesis,
      status: e.status,
      conclusion: e.conclusion,
      project: e.project,
      createdAt: e.createdAt,
      concludedAt: e.concludedAt,
      observationCount: obs.length,
      sentimentBreakdown: { positive: pos, negative: neg, neutral: neu },
    };
  });
};

export const getExperiment = (id) => {
  const experiments = getExperimentsInternal(null, null);
  return experiments.find(e => e.id === id) || null;
};

export const updateExperiment = (id, updates) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM experiments WHERE id = ?").get(id);
  if (!row) return null;

  const ts = now();
  const newName = updates.name !== undefined ? updates.name : row.name;
  const newHypothesis = updates.hypothesis !== undefined ? updates.hypothesis : row.hypothesis;
  const newProject = updates.project !== undefined ? jsonStr(Array.isArray(updates.project) ? updates.project : [updates.project]) : row.project;
  let newStatus = updates.status !== undefined ? updates.status : row.status;
  let concludedAt = row.concluded_at;
  let conclusion = updates.conclusion !== undefined ? updates.conclusion : row.conclusion;

  if (updates.status !== undefined) {
    if ((updates.status === "concluded" || updates.status === "abandoned") && !concludedAt) concludedAt = ts;
  }

  db.prepare(`
    UPDATE experiments SET name = ?, hypothesis = ?, status = ?, conclusion = ?,
      project = ?, concluded_at = ?
    WHERE id = ?
  `).run(newName, newHypothesis, newStatus, conclusion, newProject, concludedAt, id);

  return getExperiment(id);
};

export const deleteExperiment = (id) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM experiments WHERE id = ?").run(id);
  return result.changes > 0;
};

export const addObservation = (experimentId, { text, sentiment, sessionId, source }) => {
  const db = getDb();
  const ts = now();
  const existingIds = new Set(
    db.prepare("SELECT id FROM observations WHERE experiment_id = ?").all(experimentId).map(r => r.id)
  );
  const obsId = slugify(text, "o", existingIds);

  db.prepare(`
    INSERT INTO observations (id, experiment_id, text, sentiment, source, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(obsId, experimentId, text, sentiment || "neutral", source || "claude-session", sessionId || null, ts);

  return {
    id: obsId,
    text,
    sentiment: sentiment || "neutral",
    sessionId: sessionId || null,
    source: source || "claude-session",
    createdAt: ts,
  };
};

export const updateObservation = (experimentId, obsId, updates) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM observations WHERE id = ? AND experiment_id = ?").get(obsId, experimentId);
  if (!row) return null;

  const newText = updates.text !== undefined ? updates.text : row.text;
  const newSentiment = updates.sentiment !== undefined ? updates.sentiment : row.sentiment;

  db.prepare("UPDATE observations SET text = ?, sentiment = ? WHERE id = ? AND experiment_id = ?")
    .run(newText, newSentiment, obsId, experimentId);

  return rowToObservation(db.prepare("SELECT * FROM observations WHERE id = ?").get(obsId));
};

export const deleteObservation = (experimentId, obsId) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM observations WHERE id = ? AND experiment_id = ?").run(obsId, experimentId);
  return result.changes > 0;
};

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const getProfiles = () => {
  const db = getDb();
  return db.prepare("SELECT * FROM profiles ORDER BY created_at").all().map(rowToProfile);
};

export const createProfile = (data) => {
  const db = getDb();
  const ts = now();
  const existingIds = new Set(db.prepare("SELECT id FROM profiles").all().map(r => r.id));
  const id = slugify(data.name, "p", existingIds);

  db.prepare(`
    INSERT INTO profiles (id, name, task_type, project, sections, tags, model, role, system_prompt, constraints, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.taskType || "",
    data.project || null,
    jsonStr(data.sections || ["workingStyle", "architecture", "agentRules", "decisions"]),
    jsonStr(data.tags || []),
    data.model || "",
    data.role || "",
    data.systemPrompt || "",
    jsonStr(data.constraints || []),
    ts,
    ts,
  );

  return {
    id,
    name: data.name,
    taskType: data.taskType || "",
    sections: data.sections || ["workingStyle", "architecture", "agentRules", "decisions"],
    tags: data.tags || [],
    project: data.project || null,
    model: data.model || "",
    role: data.role || "",
    systemPrompt: data.systemPrompt || "",
    constraints: data.constraints || [],
    createdAt: ts,
    updatedAt: ts,
  };
};

export const updateProfile = (id, updates) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
  if (!row) return null;

  const ts = now();
  const current = rowToProfile(row);

  if (updates.name !== undefined) current.name = updates.name;
  if (updates.taskType !== undefined) current.taskType = updates.taskType;
  if (updates.sections !== undefined) current.sections = updates.sections;
  if (updates.tags !== undefined) current.tags = updates.tags;
  if (updates.project !== undefined) current.project = updates.project;
  if (updates.model !== undefined) current.model = updates.model;
  if (updates.role !== undefined) current.role = updates.role;
  if (updates.systemPrompt !== undefined) current.systemPrompt = updates.systemPrompt;
  if (updates.constraints !== undefined) current.constraints = updates.constraints;
  current.updatedAt = ts;

  db.prepare(`
    UPDATE profiles SET name = ?, task_type = ?, project = ?, sections = ?, tags = ?,
      model = ?, role = ?, system_prompt = ?, constraints = ?, updated_at = ?
    WHERE id = ?
  `).run(
    current.name, current.taskType, current.project,
    jsonStr(current.sections), jsonStr(current.tags),
    current.model, current.role, current.systemPrompt, jsonStr(current.constraints),
    ts, id,
  );

  return current;
};

export const deleteProfile = (id) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
  return result.changes > 0;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const getProjects = () => {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY created_at").all().map(rowToProject);
};

export const upsertProject = ({ id, name, repos, status }) => {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (existing) {
    db.prepare("UPDATE projects SET name = ?, repos = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(name, jsonStr(repos || []), status || "active", now(), id);
  } else {
    db.prepare("INSERT INTO projects (id, name, repos, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, name, jsonStr(repos || []), status || "active", now(), now());
  }
};

export const deleteProject = (id) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
};

export const closeProject = (id) => {
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return null;

  const ts = now();
  let archived = 0;
  let retagged = 0;

  const doClose = db.transaction(() => {
    // Mark project as closed
    db.prepare("UPDATE projects SET status = 'closed', updated_at = ? WHERE id = ?").run(ts, id);

    // Get all closed project IDs (including the one we just closed)
    const closedIds = new Set(
      db.prepare("SELECT id FROM projects WHERE status = 'closed'").all().map(r => r.id)
    );
    // Add the current project since the UPDATE above already ran
    closedIds.add(id);

    // Process entries
    const entries = db.prepare("SELECT * FROM entries").all();
    for (const row of entries) {
      const projects = parseJson(row.project, ["general"]);
      if (!projects.includes(id)) continue;

      const otherActive = projects.filter(p => p !== id && !closedIds.has(p));
      if (otherActive.length > 0) {
        // Retag: remove the closed project
        const newProj = projects.filter(p => p !== id);
        db.prepare("UPDATE entries SET project = ?, last_touched = ? WHERE id = ?")
          .run(jsonStr(newProj), ts, row.id);
        retagged++;
      } else {
        // Archive: move to archived table
        db.prepare(`
          INSERT INTO archived (section, text, confidence, source, session_id, project, annotations, history, created_at, last_touched, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.section, row.text, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, row.last_touched, ts);
        db.prepare("DELETE FROM entries WHERE id = ?").run(row.id);
        archived++;
      }
    }

    // Process decisions
    const decisions = db.prepare("SELECT * FROM decisions").all();
    for (const row of decisions) {
      const projects = parseJson(row.project, ["general"]);
      if (!projects.includes(id)) continue;

      const otherActive = projects.filter(p => p !== id && !closedIds.has(p));
      if (otherActive.length > 0) {
        const newProj = projects.filter(p => p !== id);
        db.prepare("UPDATE decisions SET project = ?, last_touched = ? WHERE id = ?")
          .run(jsonStr(newProj), ts, row.id);
        retagged++;
      } else {
        db.prepare(`
          INSERT INTO archived (section, decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched, archived_at)
          VALUES ('decisions', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.decision, row.status, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, row.last_touched, ts);
        db.prepare("DELETE FROM decisions WHERE id = ?").run(row.id);
        archived++;
      }
    }
  });

  doClose();
  return { archived, retagged };
};

export const reopenProject = (id) => {
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return null;

  const ts = now();
  let unarchived = 0;

  const doReopen = db.transaction(() => {
    db.prepare("UPDATE projects SET status = 'active', updated_at = ? WHERE id = ?").run(ts, id);

    const archivedRows = db.prepare("SELECT * FROM archived").all();
    for (const row of archivedRows) {
      const projects = parseJson(row.project, ["general"]);
      if (!projects.includes(id)) continue;

      const section = row.section || "workingStyle";
      if (section === "decisions") {
        db.prepare(`
          INSERT INTO decisions (decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.decision || row.text, row.status || "open", row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, ts);
      } else {
        db.prepare(`
          INSERT INTO entries (section, text, confidence, source, session_id, project, annotations, history, created_at, last_touched)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(section, row.text, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, ts);
      }

      db.prepare("DELETE FROM archived WHERE id = ?").run(row.id);
      unarchived++;
    }
  });

  doReopen();
  return { unarchived };
};

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export const archiveEntry = (section, text) => {
  const db = getDb();
  const ts = now();

  const doArchive = db.transaction(() => {
    if (section === "decisions") {
      const row = db.prepare("SELECT * FROM decisions WHERE decision = ?").get(text);
      if (!row) return false;
      db.prepare(`
        INSERT INTO archived (section, decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched, archived_at)
        VALUES ('decisions', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(row.decision, row.status, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, row.last_touched, ts);
      db.prepare("DELETE FROM decisions WHERE id = ?").run(row.id);
      return true;
    }

    const row = db.prepare("SELECT * FROM entries WHERE section = ? AND text = ?").get(section, text);
    if (!row) return false;
    db.prepare(`
      INSERT INTO archived (section, text, confidence, source, session_id, project, annotations, history, created_at, last_touched, archived_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(section, row.text, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, row.last_touched, ts);
    db.prepare("DELETE FROM entries WHERE id = ?").run(row.id);
    return true;
  });

  return doArchive();
};

export const getArchived = () => {
  const db = getDb();
  return db.prepare("SELECT * FROM archived ORDER BY archived_at DESC").all().map(rowToArchived);
};

export const unarchiveEntry = (text) => {
  const db = getDb();
  const ts = now();

  const row = db.prepare("SELECT * FROM archived WHERE text = ? OR decision = ?").get(text, text);
  if (!row) return null;

  const section = row.section || "workingStyle";

  const doUnarchive = db.transaction(() => {
    if (section === "decisions") {
      db.prepare(`
        INSERT INTO decisions (decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(row.decision || row.text, row.status || "open", row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, ts);
    } else {
      db.prepare(`
        INSERT INTO entries (section, text, confidence, source, session_id, project, annotations, history, created_at, last_touched)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(section, row.text, row.confidence, row.source, row.session_id, row.project, row.annotations, row.history, row.created_at, ts);
    }
    db.prepare("DELETE FROM archived WHERE id = ?").run(row.id);
  });

  doUnarchive();
  return { ok: true, section };
};

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

export const addAnnotation = (section, text, { note, source, sessionId }) => {
  const db = getDb();
  const ts = now();
  const annotation = { note, ts, source: source || "unknown", sessionId: sessionId || null };

  if (section === "decisions") {
    const row = db.prepare("SELECT * FROM decisions WHERE decision = ?").get(text);
    if (!row) return false;
    const annotations = parseJson(row.annotations, []);
    annotations.push(annotation);
    db.prepare("UPDATE decisions SET annotations = ? WHERE id = ?").run(jsonStr(annotations), row.id);
    return true;
  }

  const row = db.prepare("SELECT * FROM entries WHERE section = ? AND text = ?").get(section, text);
  if (!row) return false;
  const annotations = parseJson(row.annotations, []);
  annotations.push(annotation);
  db.prepare("UPDATE entries SET annotations = ? WHERE id = ?").run(jsonStr(annotations), row.id);
  return true;
};

export const removeAnnotation = (section, text, note) => {
  const db = getDb();

  if (section === "decisions") {
    const row = db.prepare("SELECT * FROM decisions WHERE decision = ?").get(text);
    if (!row) return false;
    const annotations = parseJson(row.annotations, []);
    const before = annotations.length;
    const filtered = annotations.filter(a => a.note !== note);
    if (filtered.length === before) return false;
    db.prepare("UPDATE decisions SET annotations = ? WHERE id = ?").run(jsonStr(filtered), row.id);
    return true;
  }

  const row = db.prepare("SELECT * FROM entries WHERE section = ? AND text = ?").get(section, text);
  if (!row) return false;
  const annotations = parseJson(row.annotations, []);
  const before = annotations.length;
  const filtered = annotations.filter(a => a.note !== note);
  if (filtered.length === before) return false;
  db.prepare("UPDATE entries SET annotations = ? WHERE id = ?").run(jsonStr(filtered), row.id);
  return true;
};

export const getAnnotatedEntries = () => {
  const db = getDb();
  const results = [];

  const entryRows = db.prepare("SELECT * FROM entries WHERE annotations != '[]'").all();
  for (const row of entryRows) {
    const annotations = parseJson(row.annotations, []);
    if (annotations.length > 0) {
      results.push({ section: row.section, text: row.text, annotations });
    }
  }

  const decisionRows = db.prepare("SELECT * FROM decisions WHERE annotations != '[]'").all();
  for (const row of decisionRows) {
    const annotations = parseJson(row.annotations, []);
    if (annotations.length > 0) {
      results.push({ section: "decisions", text: row.decision, annotations });
    }
  }

  return results;
};

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export const getWebhooks = () => {
  const db = getDb();
  return db.prepare("SELECT * FROM webhooks ORDER BY created_at").all().map(rowToWebhook);
};

export const addWebhook = (url, events) => {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM webhooks WHERE url = ?").get(url);
  if (existing) return false;
  db.prepare("INSERT INTO webhooks (url, events, created_at) VALUES (?, ?, ?)").run(url, jsonStr(events), now());
  return true;
};

export const removeWebhook = (url) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM webhooks WHERE url = ?").run(url);
  return result.changes > 0;
};

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export const addLogEntry = ({ action, section, source, sessionId, value }) => {
  const db = getDb();
  const ts = now();
  const summary = typeof value === "object" ? (value.text || value.decision || JSON.stringify(value).slice(0, 200)) : (value || "");

  db.prepare(`
    INSERT INTO activity_log (timestamp, action, section, source, session_id, value_summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ts, action, section, source || "unknown", sessionId || null, summary);

  // Cap at 500 entries
  const count = db.prepare("SELECT COUNT(*) as cnt FROM activity_log").get().cnt;
  if (count > 500) {
    db.prepare(`
      DELETE FROM activity_log WHERE id IN (
        SELECT id FROM activity_log ORDER BY timestamp ASC LIMIT ?
      )
    `).run(count - 500);
  }
};

export const getLog = () => {
  const db = getDb();
  return db.prepare("SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 500").all().map(rowToLogEntry);
};

export const clearLog = () => {
  const db = getDb();
  db.prepare("DELETE FROM activity_log").run();
};

// ---------------------------------------------------------------------------
// Context (the big one)
// ---------------------------------------------------------------------------

export const getContextMarkdown = ({ projectId, missionId, profileId, format }) => {
  const compact = format === "compact";
  const db = getDb();

  // Resolve mission → project
  let mission = null;
  if (missionId) {
    mission = getMission(missionId);
    if (!mission) return { error: "not_found", message: `Mission not found: ${missionId}` };
    if (!projectId && mission.project) projectId = mission.project;
  }

  // Resolve profile
  let profileFilter = null;
  if (profileId) {
    const profiles = getProfiles();
    profileFilter = profiles.find(p => p.id === profileId);
    if (!profileFilter) return { error: "not_found", message: `Profile not found: ${profileId}` };
    if (profileFilter.project && !projectId) projectId = profileFilter.project;
  }

  // Load data
  const allProjects = getProjects();
  const closedProjectIds = new Set(allProjects.filter(p => p.status === "closed").map(p => p.id));
  const archivedTexts = new Set(getArchived().map(e => e.text || e.decision || ""));

  const filterActive = (entries, textField = "text") => entries.filter(e => {
    const t = e[textField] || "";
    if (archivedTexts.has(t)) return false;
    const projects = e.project || ["general"];
    return projects.some(p => !closedProjectIds.has(p));
  });

  const filterByProfileTags = (entries, textField = "text") => {
    if (!profileFilter || !profileFilter.tags || profileFilter.tags.length === 0) return entries;
    return entries.filter(e => {
      const t = (e[textField] || "").toLowerCase();
      return profileFilter.tags.some(tag => t.includes(tag.toLowerCase()));
    });
  };

  const sortByConfidence = (entries) => [...entries].sort((a, b) => {
    const ca = a.confidence === "firm" ? 0 : 1;
    const cb = b.confidence === "firm" ? 0 : 1;
    return ca - cb;
  });

  const formatEntry = (e, textField = "text") => {
    const t = e[textField] || "";
    if (compact) return `- ${t}`;
    const conf = e.confidence ? ` [${e.confidence}]` : "";
    return `- ${t}${conf}`;
  };

  const lines = [];

  // Header
  const headerPrefix = compact ? "# Context" : "# Brain Context";
  if (mission) {
    const proj = projectId ? allProjects.find(p => p.id === projectId) : null;
    lines.push(`${headerPrefix} — Mission: ${mission.name}${proj ? ` (${proj.name})` : ""}`);
    lines.push("");
  } else if (profileFilter) {
    lines.push(`${headerPrefix} — Profile: ${profileFilter.name}`);
    lines.push("");
    if (profileFilter.model || profileFilter.role || profileFilter.systemPrompt || (profileFilter.constraints && profileFilter.constraints.length)) {
      lines.push("## Agent Persona");
      if (profileFilter.model) lines.push(`- **Model:** ${profileFilter.model}`);
      if (profileFilter.role) lines.push(`- **Role:** ${profileFilter.role}`);
      if (profileFilter.systemPrompt) {
        lines.push(`- **System prompt:**`);
        lines.push(profileFilter.systemPrompt);
      }
      if (profileFilter.constraints && profileFilter.constraints.length) {
        lines.push(`- **Constraints:**`);
        profileFilter.constraints.forEach(c => lines.push(`  - ${c}`));
      }
      lines.push("");
    }
  } else if (projectId) {
    const proj = allProjects.find(p => p.id === projectId);
    lines.push(`${headerPrefix} — ${proj ? proj.name : projectId}`);
    lines.push("");
  }

  // Sections
  const sectionNames = ["workingStyle", "architecture", "agentRules"];
  const sectionLabels = { workingStyle: "Working Style", architecture: "Architecture", agentRules: "Agent Rules" };
  const compactLabels = { workingStyle: "Style", architecture: "Arch", agentRules: "Rules" };

  for (const section of sectionNames) {
    if (profileFilter && !profileFilter.sections.includes(section)) continue;
    let entries = getEntries(section, projectId);
    entries = filterActive(entries);
    entries = filterByProfileTags(entries);
    entries = sortByConfidence(entries);
    if (entries.length) {
      lines.push(`## ${compact ? compactLabels[section] : sectionLabels[section]}`);
      entries.forEach(e => lines.push(formatEntry(e)));
      lines.push("");
    }
  }

  // Decisions
  if (!profileFilter || profileFilter.sections.includes("decisions")) {
    let decisions = getDecisions(projectId);
    decisions = filterActive(decisions, "decision");
    decisions = filterByProfileTags(decisions, "decision");

    const openDecisions = decisions.filter(d => d.status !== "resolved");
    const resolvedDecisions = decisions.filter(d => d.status === "resolved");

    if (openDecisions.length) {
      lines.push(compact ? "## Decisions (open)" : "## Open Decisions");
      sortByConfidence(openDecisions).forEach(d => lines.push(compact ? `- ${d.decision}` : `- \u25CB ${d.decision}`));
      lines.push("");
    }

    if (resolvedDecisions.length) {
      lines.push(compact ? "## Decisions (resolved)" : "## Resolved Decisions");
      sortByConfidence(resolvedDecisions).forEach(d => lines.push(compact ? `- ${d.decision}` : `- \u2713 ${d.decision}`));
      lines.push("");
    }
  }

  // Reminders
  if (!profileFilter || profileFilter.sections.includes("reminders")) {
    const ts = now();
    const allReminders = db.prepare("SELECT * FROM reminders WHERE status IN ('pending', 'snoozed')").all().map(rowToReminder);
    let pendingReminders = allReminders.filter(r => {
      const isPending = r.status === "pending";
      const isExpiredSnooze = r.status === "snoozed" && r.snoozedUntil && r.snoozedUntil <= ts;
      if (!isPending && !isExpiredSnooze) return false;
      if (projectId && !(r.project || []).includes(projectId)) return false;
      return true;
    });
    if (pendingReminders.length) {
      pendingReminders = sortReminders(pendingReminders);
      lines.push("## Reminders");
      for (const r of pendingReminders) {
        const priorityTag = r.priority !== "normal" ? `[${r.priority}] ` : "";
        const dueTag = r.dueDate ? ` (due: ${r.dueDate.slice(0, 10)})` : "";
        lines.push(`- ${priorityTag}${r.text}${dueTag}`);
      }
      lines.push("");
    }
  }

  // Experiments
  const allExps = getExperimentsInternal(null, projectId || null);
  const activeExperiments = allExps.filter(e => e.status === "active");
  const concludedExperiments = allExps.filter(e => e.status === "concluded");

  if (activeExperiments.length) {
    lines.push(compact ? "## Experiments" : "## Active Experiments");
    for (const exp of activeExperiments) {
      if (compact) {
        const obs = exp.observations || [];
        lines.push(`- ${exp.name} (${obs.length} obs)`);
      } else {
        lines.push(`- **${exp.name}** (\`${exp.id}\`)`);
        lines.push(`  Hypothesis: ${exp.hypothesis}`);
        const obs = exp.observations || [];
        if (obs.length) {
          const pos = obs.filter(o => o.sentiment === "positive").length;
          const neg = obs.filter(o => o.sentiment === "negative").length;
          const neu = obs.filter(o => o.sentiment === "neutral").length;
          lines.push(`  Observations: ${obs.length} (${pos} positive, ${neg} negative, ${neu} neutral)`);
          const recent = obs.slice(-2);
          for (const o of recent) {
            const icon = o.sentiment === "positive" ? "+" : o.sentiment === "negative" ? "-" : "~";
            lines.push(`  [${icon}] ${o.text}`);
          }
        } else {
          lines.push(`  No observations yet.`);
        }
      }
    }
    lines.push("");
  }

  if (concludedExperiments.length) {
    lines.push(compact ? "## Experiments (concluded)" : "## Concluded Experiments");
    for (const exp of concludedExperiments) {
      const obs = exp.observations || [];
      lines.push(compact
        ? `- ${exp.name} — ${exp.conclusion || "no verdict"}`
        : `- **${exp.name}** — ${exp.conclusion || "no verdict"} (${obs.length} observations)`);
    }
    lines.push("");
  }

  // Mission tasks
  if (mission) {
    const statusIcon = { pending: "○", in_progress: "▶", completed: "✓", blocked: "✗" };
    lines.push(`## Active Mission: ${mission.name}`);
    lines.push(`- **ID:** ${mission.id}`);
    lines.push(`- **Status:** ${mission.status}`);
    if (mission.createdAt) lines.push(`- **Created:** ${mission.createdAt}`);
    lines.push("");
    lines.push("### Tasks");
    const missionTasks = compact
      ? (mission.tasks || []).filter(t => t.status === "pending" || t.status === "in_progress")
      : (mission.tasks || []);
    for (const t of missionTasks) {
      const icon = statusIcon[t.status] || "?";
      let line = `- ${icon} \`${t.id}\` ${t.description}`;
      if (t.assignedAgent) line += ` (agent: ${t.assignedAgent})`;
      if (t.output) line += ` — ${t.output}`;
      if (t.blockers && t.blockers.length) line += ` [blocked: ${t.blockers.join(", ")}]`;
      lines.push(line);
    }
    lines.push("");
  }

  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const getTimeline = (projectId) => {
  const entries = [];

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    const sectionEntries = getEntries(section, projectId);
    for (const e of sectionEntries) {
      entries.push({
        text: e.text,
        section,
        createdAt: e.createdAt || null,
        archivedAt: null,
        removedAt: null,
      });
    }
  }

  const decisions = getDecisions(projectId);
  for (const d of decisions) {
    entries.push({
      text: d.decision,
      section: "decisions",
      createdAt: d.createdAt || null,
      archivedAt: null,
      removedAt: null,
    });
  }

  const archived = getArchived();
  for (const a of archived) {
    if (projectId) {
      const projects = a.project || ["general"];
      if (!projects.includes(projectId)) continue;
    }
    entries.push({
      text: a.text || a.decision || "",
      section: a.section || "unknown",
      createdAt: a.createdAt || null,
      archivedAt: a.archivedAt || null,
      removedAt: null,
    });
  }

  entries.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const dates = entries.map(e => e.createdAt).filter(Boolean);
  return {
    earliest: dates[0] || null,
    latest: dates[dates.length - 1] || null,
    entries,
  };
};

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export const diffEntries = (incomingEntries, project) => {
  const MATCH_THRESHOLD = 0.4;
  const missing = [];
  const matched = [];

  // Load all brain entries for comparison
  const allEntries = {};
  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    allEntries[section] = getEntries(section, project || null);
  }
  allEntries.decisions = getDecisions(project || null);

  for (const incoming of incomingEntries) {
    const text = incoming.text || "";
    const section = incoming.section || null;
    const incomingTokens = tokenize(text);

    if (incomingTokens.length === 0) {
      missing.push({ text, suggestedSection: section || detectSection(text) });
      continue;
    }

    let bestSim = 0;
    let bestText = "";
    let bestSection = null;

    const sectionsToSearch = section
      ? [section]
      : ["workingStyle", "architecture", "agentRules"];

    for (const sec of sectionsToSearch) {
      if (sec === "decisions") continue;
      for (const entry of (allEntries[sec] || [])) {
        const eTokens = tokenize(entry.text);
        const sim = similarity(incomingTokens, eTokens);
        if (sim > bestSim) {
          bestSim = sim;
          bestText = entry.text;
          bestSection = sec;
        }
      }
    }

    // Always check decisions
    for (const d of (allEntries.decisions || [])) {
      const dTokens = tokenize(d.decision);
      const sim = similarity(incomingTokens, dTokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestText = d.decision;
        bestSection = "decisions";
      }
    }

    if (bestSim >= MATCH_THRESHOLD) {
      matched.push({ text, matchedWith: bestText, section: bestSection, similarity: Math.round(bestSim * 100) / 100 });
    } else {
      missing.push({ text, suggestedSection: section || detectSection(text) });
    }
  }

  return { missing, matched };
};

// ---------------------------------------------------------------------------
// Conflict check
// ---------------------------------------------------------------------------

export const checkConflicts = (value, targetSection) => {
  const inputTokens = tokenize(value);
  if (inputTokens.length === 0) return { conflicts: [] };

  const inputLower = value.toLowerCase();
  const oppositionPairs = [
    ["always", "never"],
    ["must", "must not"],
    ["do", "don't"],
  ];

  const conflicts = [];

  const sections = targetSection
    ? [targetSection]
    : ["workingStyle", "architecture", "agentRules", "decisions"];

  for (const section of sections) {
    let list;
    if (section === "decisions") {
      list = getDecisions().map(d => ({ text: d.decision }));
    } else {
      list = getEntries(section);
    }

    for (const entry of list) {
      const text = entry.text || "";
      const entryTokens = tokenize(text);
      const overlap = inputTokens.filter(t => entryTokens.includes(t));
      if (overlap.length === 0) continue;

      const entryLower = text.toLowerCase();
      let reason = null;

      for (const [a, b] of oppositionPairs) {
        if (inputLower.includes(a) && entryLower.includes(b)) {
          reason = `opposing: ${a} vs ${b}`;
          break;
        }
        if (inputLower.includes(b) && entryLower.includes(a)) {
          reason = `opposing: ${b} vs ${a}`;
          break;
        }
      }

      if (reason) {
        conflicts.push({ section, text, reason, overlap });
      }
    }
  }

  return { conflicts };
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const getSessions = () => {
  const db = getDb();
  const sessions = {};

  const track = (sessionId, createdAt, section, entryProjects) => {
    if (!sessionId) return;
    if (!sessions[sessionId]) sessions[sessionId] = { id: sessionId, count: 0, sections: {}, projects: new Set(), earliest: createdAt, latest: createdAt };
    const s = sessions[sessionId];
    s.count++;
    s.sections[section] = (s.sections[section] || 0) + 1;
    if (createdAt && createdAt < s.earliest) s.earliest = createdAt;
    if (createdAt && createdAt > s.latest) s.latest = createdAt;
    if (entryProjects) entryProjects.forEach(p => s.projects.add(p));
  };

  const entryRows = db.prepare("SELECT section, session_id, created_at, project FROM entries WHERE session_id IS NOT NULL").all();
  for (const row of entryRows) {
    track(row.session_id, row.created_at, row.section, parseJson(row.project, []));
  }

  const decisionRows = db.prepare("SELECT session_id, created_at, project FROM decisions WHERE session_id IS NOT NULL").all();
  for (const row of decisionRows) {
    track(row.session_id, row.created_at, "decisions", parseJson(row.project, []));
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const result = Object.values(sessions).map(s => {
    let label = null;
    if (uuidPattern.test(s.id)) {
      try {
        label = fs.readFileSync(path.join(os.homedir(), ".claude", "sessions", s.id + ".label"), "utf8").trim();
      } catch { /* no label file */ }
    }
    return { ...s, label, projects: [...s.projects] };
  });

  return result.sort((a, b) => (b.latest || "").localeCompare(a.latest || ""));
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const getMetrics = (projectId) => {
  const sections = ["workingStyle", "architecture", "agentRules"];
  const bySection = {};
  const byConfidence = { firm: 0, tentative: 0 };
  const byStatus = { open: 0, resolved: 0 };
  let totalEntries = 0;
  let totalAgeDays = 0;
  let oldestEntry = null;
  let newestEntry = null;
  const sessionIds = new Set();
  let annotationsCount = 0;
  const ts = Date.now();

  for (const section of sections) {
    const entries = getEntries(section, projectId);
    bySection[section] = entries.length;
    totalEntries += entries.length;

    for (const entry of entries) {
      if (entry.confidence === "firm") byConfidence.firm++;
      else byConfidence.tentative++;

      if (entry.createdAt) {
        const ageDays = (ts - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        totalAgeDays += ageDays;
        if (!oldestEntry || entry.createdAt < oldestEntry.createdAt) oldestEntry = { text: entry.text, section, createdAt: entry.createdAt };
        if (!newestEntry || entry.createdAt > newestEntry.createdAt) newestEntry = { text: entry.text, section, createdAt: entry.createdAt };
      }

      if (entry.sessionId) sessionIds.add(entry.sessionId);
      if (entry.annotations) annotationsCount += entry.annotations.length;
    }
  }

  // Decisions
  const decisions = getDecisions(projectId);
  bySection.decisions = decisions.length;
  totalEntries += decisions.length;

  for (const d of decisions) {
    if (d.confidence === "firm") byConfidence.firm++;
    else byConfidence.tentative++;

    if (d.status === "resolved") byStatus.resolved++;
    else byStatus.open++;

    if (d.createdAt) {
      const ageDays = (ts - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      totalAgeDays += ageDays;
      if (!oldestEntry || d.createdAt < oldestEntry.createdAt) oldestEntry = { text: d.decision, section: "decisions", createdAt: d.createdAt };
      if (!newestEntry || d.createdAt > newestEntry.createdAt) newestEntry = { text: d.decision, section: "decisions", createdAt: d.createdAt };
    }

    if (d.sessionId) sessionIds.add(d.sessionId);
    if (d.annotations) annotationsCount += d.annotations.length;
  }

  // Activity by day from log (last 30 days)
  const activityByDay = {};
  const thirtyDaysAgo = new Date(ts - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const logEntries = getLog();
  for (const entry of logEntries) {
    if (!entry.ts) continue;
    const day = entry.ts.slice(0, 10);
    if (day >= thirtyDaysAgo) {
      activityByDay[day] = (activityByDay[day] || 0) + 1;
    }
  }

  return {
    totalEntries,
    bySection,
    byConfidence,
    byStatus,
    archived: getArchived().length,
    avgAgeDays: totalEntries > 0 ? Math.round(totalAgeDays / totalEntries) : 0,
    oldestEntry,
    newestEntry,
    sessionsCount: sessionIds.size,
    annotationsCount,
    activityByDay,
  };
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const checkHealth = (repoPath) => {
  const pathRegex = /(?:^|\s|['"`])((?:src|components|hooks|server|routes|lib|services|modules|app|pages|utils|assets|styles|models|shared|features|core|config|public)\/[\w\/\-\.]+\.\w+)/gi;

  const staleEntries = [];
  const healthyEntries = [];
  let checkedEntries = 0;
  let noReferencesEntries = 0;

  const checkSection = (entries, section, textField = "text") => {
    for (const entry of entries) {
      const text = entry[textField] || "";
      const matches = [...text.matchAll(pathRegex)];
      if (matches.length === 0) {
        noReferencesEntries++;
        continue;
      }
      checkedEntries++;
      const references = matches.map(m => {
        const p = m[1];
        const fullPath = path.join(repoPath, p);
        return { path: p, exists: fs.existsSync(fullPath) };
      });
      const hasStale = references.some(r => !r.exists);
      (hasStale ? staleEntries : healthyEntries).push({ section, text, references });
    }
  };

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    checkSection(getEntries(section), section);
  }

  const decisions = getDecisions();
  checkSection(decisions.map(d => ({ text: d.decision })), "decisions");

  return { checkedEntries, staleEntries, healthyEntries, noReferencesEntries };
};

// ---------------------------------------------------------------------------
// Full brain (backwards compat for GET /memory)
// ---------------------------------------------------------------------------

export const getFullBrain = (projectId) => {
  const brain = {
    workingStyle: getEntries("workingStyle", projectId),
    architecture: getEntries("architecture", projectId),
    agentRules: getEntries("agentRules", projectId),
    decisions: getDecisions(projectId),
    log: getLog(),
    archived: getArchived(),
    webhooks: getWebhooks(),
    missions: [],
    profiles: getProfiles(),
    reminders: [],
    experiments: [],
    projects: getProjects(),
  };

  // Missions: reconstruct with tasks embedded
  const missionSummaries = getMissions(null, null);
  brain.missions = missionSummaries.map(ms => {
    const full = getMission(ms.id);
    return full || ms;
  });

  // Reminders: get all
  const db = getDb();
  brain.reminders = db.prepare("SELECT * FROM reminders ORDER BY created_at").all().map(rowToReminder);

  // Experiments: get all with observations
  brain.experiments = getExperimentsInternal(null, null);

  // Apply project filter if requested
  if (projectId) {
    brain.missions = brain.missions.filter(m => m.project === projectId);
    brain.reminders = brain.reminders.filter(r => (r.project || []).includes(projectId));
    brain.experiments = brain.experiments.filter(e => (e.project || []).includes(projectId));
  }

  return brain;
};

// ---------------------------------------------------------------------------
// Sessions (structured lifecycle tracking)
// ---------------------------------------------------------------------------

export const startSession = ({ id, label, project }) => {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
  if (existing) {
    const sets = [];
    const params = [];
    if (label !== undefined) { sets.push("label = ?"); params.push(label); }
    if (project !== undefined) { sets.push("project = ?"); params.push(project); }
    if (sets.length) {
      params.push(id);
      db.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  }
  db.prepare("INSERT INTO sessions (id, label, project) VALUES (?, ?, ?)").run(id, label || null, project || null);
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
};

export const endSession = (id, { handoff } = {}) => {
  const db = getDb();
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  if (!session) return null;
  if (session.ended_at) return { error: "already_ended", message: `Session ${id} already ended at ${session.ended_at}` };
  db.prepare("UPDATE sessions SET ended_at = datetime('now'), handoff = ? WHERE id = ?").run(
    handoff ? JSON.stringify(handoff) : null, id
  );
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  return { ...row, handoff: row.handoff ? JSON.parse(row.handoff) : null };
};

export const getSessionById = (id) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  if (!row) return null;
  return { ...row, handoff: row.handoff ? JSON.parse(row.handoff) : null };
};

export const listSessions = ({ limit = 50, project } = {}) => {
  const db = getDb();
  let sql = "SELECT * FROM sessions";
  const params = [];
  if (project) { sql += " WHERE project = ?"; params.push(project); }
  sql += " ORDER BY started_at DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params).map(row => ({
    ...row,
    handoff: row.handoff ? JSON.parse(row.handoff) : null,
  }));
};

export const getLatestHandoff = (project) => {
  const db = getDb();
  let sql = "SELECT * FROM sessions WHERE handoff IS NOT NULL";
  const params = [];
  if (project) { sql += " AND project = ?"; params.push(project); }
  sql += " ORDER BY ended_at DESC LIMIT 1";
  const row = db.prepare(sql).get(...params);
  if (!row) return null;
  return { ...row, handoff: row.handoff ? JSON.parse(row.handoff) : null };
};

export const searchSessions = (query, project) => {
  const db = getDb();
  const q = `%${query}%`;
  let sql = "SELECT * FROM sessions WHERE (label LIKE ? OR handoff LIKE ? OR project LIKE ?)";
  const params = [q, q, q];
  if (project) { sql += " AND project = ?"; params.push(project); }
  sql += " ORDER BY started_at DESC LIMIT 20";
  return db.prepare(sql).all(...params).map(row => ({
    ...row,
    handoff: row.handoff ? JSON.parse(row.handoff) : null,
  }));
};

// ---------------------------------------------------------------------------
// Mission templates (reusable blueprints)
// ---------------------------------------------------------------------------

export const createTemplate = ({ name, description, project, tasks }) => {
  const db = getDb();
  const existingIds = new Set(db.prepare("SELECT id FROM mission_templates").all().map(r => r.id));
  const id = slugify(name, "tmpl", existingIds);
  const ts = now();
  db.prepare(`
    INSERT INTO mission_templates (id, name, description, project, tasks, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || "", project || null, JSON.stringify(tasks || []), ts, ts);
  return { id, name, description: description || "", project: project || null, tasks: tasks || [], createdAt: ts, updatedAt: ts };
};

export const getTemplates = (project) => {
  const db = getDb();
  let sql = "SELECT * FROM mission_templates";
  const params = [];
  if (project) { sql += " WHERE project = ? OR project IS NULL"; params.push(project); }
  sql += " ORDER BY name ASC";
  return db.prepare(sql).all(...params).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    project: row.project,
    tasks: JSON.parse(row.tasks || "[]"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const getTemplate = (id) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM mission_templates WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    project: row.project,
    tasks: JSON.parse(row.tasks || "[]"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateTemplate = (id, updates) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM mission_templates WHERE id = ?").get(id);
  if (!existing) return null;
  const sets = [];
  const params = [];
  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push("description = ?"); params.push(updates.description); }
  if (updates.project !== undefined) { sets.push("project = ?"); params.push(updates.project); }
  if (updates.tasks !== undefined) { sets.push("tasks = ?"); params.push(JSON.stringify(updates.tasks)); }
  if (sets.length === 0) return getTemplate(id);
  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE mission_templates SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getTemplate(id);
};

export const deleteTemplate = (id) => {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM mission_templates WHERE id = ?").get(id);
  if (!existing) return false;
  db.prepare("DELETE FROM mission_templates WHERE id = ?").run(id);
  return true;
};
