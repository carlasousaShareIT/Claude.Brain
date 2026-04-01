// migrate-json-to-db.js — One-time migration from brain.json to SQLite

import fs from "fs";
import os from "os";
import path from "path";
import { getDb } from "./db.js";

const defaultBrainFile = path.join(os.homedir(), ".claude", "brain.json");
const BRAIN_FILE = process.env.BRAIN_FILE || defaultBrainFile;

/**
 * Normalize an entry that might be a plain string into an object.
 */
const normalizeEntry = (item) => {
  if (typeof item === "string") {
    return {
      text: item,
      confidence: "tentative",
      source: "unknown",
      project: ["general"],
      sessionId: null,
      createdAt: new Date().toISOString(),
      lastTouched: new Date().toISOString(),
    };
  }
  return item;
};

/**
 * Safely JSON-stringify array fields, defaulting to '[]' for nullish values.
 */
const jsonArr = (val) => {
  if (val == null) return "[]";
  if (typeof val === "string") return val; // already serialized
  return JSON.stringify(val);
};

/**
 * Truncate a value to a summary string of at most `maxLen` characters.
 */
const truncate = (val, maxLen = 500) => {
  if (val == null) return null;
  const str = typeof val === "string" ? val : JSON.stringify(val);
  return str.length > maxLen ? str.slice(0, maxLen) : str;
};

/**
 * Migrate brain.json data into the SQLite database.
 * Idempotent: skips if already migrated (checks schema_meta for 'json_migrated').
 */
export const migrateJsonToDb = () => {
  const db = getDb();

  // --- Idempotency check ---
  const already = db
    .prepare("SELECT value FROM schema_meta WHERE key = 'json_migrated'")
    .get();
  if (already) {
    console.log(
      `[migrate] Already migrated on ${already.value}. Skipping.`
    );
    return;
  }

  // --- Read brain.json ---
  if (!fs.existsSync(BRAIN_FILE)) {
    console.log(`[migrate] ${BRAIN_FILE} not found. Nothing to migrate.`);
    return;
  }

  const raw = fs.readFileSync(BRAIN_FILE, "utf-8");
  let brain;
  try {
    brain = JSON.parse(raw);
  } catch (err) {
    console.error(`[migrate] Failed to parse brain.json: ${err.message}`);
    return;
  }

  // --- Backup brain.json ---
  const backupPath = BRAIN_FILE + ".pre-sqlite-bak";
  try {
    fs.copyFileSync(BRAIN_FILE, backupPath);
    console.log(`[migrate] Backed up brain.json to ${backupPath}`);
  } catch (err) {
    console.error(`[migrate] Backup failed: ${err.message}. Aborting.`);
    return;
  }

  // --- Counters ---
  const counts = {
    entries: 0,
    decisions: 0,
    missions: 0,
    mission_tasks: 0,
    reminders: 0,
    experiments: 0,
    observations: 0,
    profiles: 0,
    projects: 0,
    webhooks: 0,
    activity_log: 0,
    archived: 0,
  };

  // --- Prepare statements ---
  const stmts = {
    entry: db.prepare(`
      INSERT INTO entries (section, text, confidence, source, session_id, project, annotations, history, created_at, last_touched)
      VALUES (@section, @text, @confidence, @source, @session_id, @project, @annotations, @history, @created_at, @last_touched)
    `),
    decision: db.prepare(`
      INSERT INTO decisions (decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched)
      VALUES (@decision, @status, @confidence, @source, @session_id, @project, @annotations, @history, @created_at, @last_touched)
    `),
    mission: db.prepare(`
      INSERT INTO missions (id, name, project, status, session_id, created_at, completed_at)
      VALUES (@id, @name, @project, @status, @session_id, @created_at, @completed_at)
    `),
    missionTask: db.prepare(`
      INSERT INTO mission_tasks (id, mission_id, description, status, assigned_agent, session_id, output, blockers, created_at, started_at, completed_at)
      VALUES (@id, @mission_id, @description, @status, @assigned_agent, @session_id, @output, @blockers, @created_at, @started_at, @completed_at)
    `),
    reminder: db.prepare(`
      INSERT INTO reminders (id, text, status, priority, due_date, snoozed_until, project, created_at, completed_at)
      VALUES (@id, @text, @status, @priority, @due_date, @snoozed_until, @project, @created_at, @completed_at)
    `),
    experiment: db.prepare(`
      INSERT INTO experiments (id, name, hypothesis, status, conclusion, project, session_id, created_at, concluded_at)
      VALUES (@id, @name, @hypothesis, @status, @conclusion, @project, @session_id, @created_at, @concluded_at)
    `),
    observation: db.prepare(`
      INSERT INTO observations (id, experiment_id, text, sentiment, source, session_id, created_at)
      VALUES (@id, @experiment_id, @text, @sentiment, @source, @session_id, @created_at)
    `),
    profile: db.prepare(`
      INSERT INTO profiles (id, name, task_type, project, sections, tags, model, role, system_prompt, constraints, created_at, updated_at)
      VALUES (@id, @name, @task_type, @project, @sections, @tags, @model, @role, @system_prompt, @constraints, @created_at, @updated_at)
    `),
    project: db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, repos, status, created_at)
      VALUES (@id, @name, @repos, @status, @created_at)
    `),
    webhook: db.prepare(`
      INSERT OR IGNORE INTO webhooks (url, events)
      VALUES (@url, @events)
    `),
    activityLog: db.prepare(`
      INSERT INTO activity_log (timestamp, action, section, source, session_id, value_summary)
      VALUES (@timestamp, @action, @section, @source, @session_id, @value_summary)
    `),
    archived: db.prepare(`
      INSERT INTO archived (section, text, decision, status, confidence, source, session_id, project, annotations, history, created_at, last_touched, archived_at)
      VALUES (@section, @text, @decision, @status, @confidence, @source, @session_id, @project, @annotations, @history, @created_at, @last_touched, @archived_at)
    `),
    setMeta: db.prepare(`
      INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))
    `),
  };

  // --- Run everything in a single transaction ---
  const migrate = db.transaction(() => {
    // --- Entries (workingStyle, architecture, agentRules) ---
    for (const section of ["workingStyle", "architecture", "agentRules"]) {
      const items = brain[section] || [];
      for (const raw of items) {
        const e = normalizeEntry(raw);
        stmts.entry.run({
          section,
          text: e.text,
          confidence: e.confidence || "tentative",
          source: e.source || "unknown",
          session_id: e.sessionId || null,
          project: jsonArr(e.project),
          annotations: jsonArr(e.annotations),
          history: jsonArr(e.history),
          created_at: e.createdAt || new Date().toISOString(),
          last_touched: e.lastTouched || e.createdAt || new Date().toISOString(),
        });
        counts.entries++;
      }
    }

    // --- Decisions ---
    for (const d of brain.decisions || []) {
      stmts.decision.run({
        decision: d.decision,
        status: d.status || "open",
        confidence: d.confidence || "tentative",
        source: d.source || "unknown",
        session_id: d.sessionId || null,
        project: jsonArr(d.project),
        annotations: jsonArr(d.annotations),
        history: jsonArr(d.history),
        created_at: d.createdAt || new Date().toISOString(),
        last_touched: d.lastTouched || d.createdAt || new Date().toISOString(),
      });
      counts.decisions++;
    }

    // --- Missions + tasks ---
    for (const m of brain.missions || []) {
      stmts.mission.run({
        id: m.id,
        name: m.name,
        project: m.project || null, // string, not array
        status: m.status || "active",
        session_id: m.createdInSession || null,
        created_at: m.createdAt || new Date().toISOString(),
        completed_at: m.completedAt || null,
      });
      counts.missions++;

      for (const t of m.tasks || []) {
        stmts.missionTask.run({
          id: t.id,
          mission_id: m.id,
          description: t.description,
          status: t.status || "pending",
          assigned_agent: t.assignedAgent || null,
          session_id: t.sessionId || null,
          output: t.output || null,
          blockers: jsonArr(t.blockers),
          created_at: t.createdAt || new Date().toISOString(),
          started_at: t.startedAt || null,
          completed_at: t.completedAt || null,
        });
        counts.mission_tasks++;
      }
    }

    // --- Reminders ---
    for (const r of brain.reminders || []) {
      stmts.reminder.run({
        id: r.id,
        text: r.text,
        status: r.status || "pending",
        priority: r.priority || "normal",
        due_date: r.dueDate || null,
        snoozed_until: r.snoozedUntil || null,
        project: jsonArr(r.project),
        created_at: r.createdAt || new Date().toISOString(),
        completed_at: r.completedAt || null,
      });
      counts.reminders++;
    }

    // --- Experiments + observations ---
    for (const exp of brain.experiments || []) {
      stmts.experiment.run({
        id: exp.id,
        name: exp.name,
        hypothesis: exp.hypothesis,
        status: exp.status || "active",
        conclusion: exp.conclusion || null,
        project: jsonArr(exp.project),
        session_id: exp.sessionId || null,
        created_at: exp.createdAt || new Date().toISOString(),
        concluded_at: exp.concludedAt || null,
      });
      counts.experiments++;

      for (const obs of exp.observations || []) {
        stmts.observation.run({
          id: obs.id,
          experiment_id: exp.id,
          text: obs.text,
          sentiment: obs.sentiment || "neutral",
          source: obs.source || "claude-session",
          session_id: obs.sessionId || null,
          created_at: obs.createdAt || new Date().toISOString(),
        });
        counts.observations++;
      }
    }

    // --- Profiles ---
    for (const p of brain.profiles || []) {
      stmts.profile.run({
        id: p.id,
        name: p.name,
        task_type: p.taskType || "",
        project: p.project || null, // string, not array
        sections: jsonArr(p.sections),
        tags: jsonArr(p.tags),
        model: p.model || "",
        role: p.role || "",
        system_prompt: p.systemPrompt || "",
        constraints: jsonArr(p.constraints),
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: p.updatedAt || p.createdAt || new Date().toISOString(),
      });
      counts.profiles++;
    }

    // --- Projects ---
    for (const p of brain.projects || []) {
      stmts.project.run({
        id: p.id,
        name: p.name,
        repos: jsonArr(p.repos),
        status: p.status || "active",
        created_at: p.createdAt || new Date().toISOString(),
      });
      counts.projects++;
    }

    // --- Webhooks ---
    for (const w of brain.webhooks || []) {
      stmts.webhook.run({
        url: w.url,
        events: jsonArr(w.events),
      });
      counts.webhooks++;
    }

    // --- Activity log ---
    for (const l of brain.log || []) {
      stmts.activityLog.run({
        timestamp: l.ts || new Date().toISOString(),
        action: l.action || "unknown",
        section: l.section || "unknown",
        source: l.source || "unknown",
        session_id: l.sessionId || null,
        value_summary: truncate(l.value),
      });
      counts.activity_log++;
    }

    // --- Archived ---
    for (const a of brain.archived || []) {
      stmts.archived.run({
        section: a.section || "unknown",
        text: a.text || null,
        decision: a.decision || null,
        status: a.status || null,
        confidence: a.confidence || null,
        source: a.source || null,
        session_id: a.sessionId || null,
        project: jsonArr(a.project),
        annotations: jsonArr(a.annotations),
        history: jsonArr(a.history),
        created_at: a.createdAt || null,
        last_touched: a.lastTouched || null,
        archived_at: a.archivedAt || new Date().toISOString(),
      });
      counts.archived++;
    }

    // --- Mark migration complete ---
    stmts.setMeta.run("json_migrated", new Date().toISOString());
  });

  // Execute the transaction
  migrate();

  // --- Report ---
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${n} ${table}`);
  console.log(`[migrate] Migrated: ${parts.join(", ")}.`);
};

// --- CLI entry point: run directly with `node migrate-json-to-db.js` ---
const thisFile = new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const argFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (path.resolve(thisFile) === argFile) {
  try {
    migrateJsonToDb();
  } catch (err) {
    console.error(`[migrate] Migration failed: ${err.message}`);
    process.exit(1);
  }
}
