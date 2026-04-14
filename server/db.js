// db.js — SQLite database initialization and schema management

import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

// Resolve database file path: env var > ~/.claude/brain.db
const defaultDbFile = path.join(os.homedir(), ".claude", "brain.db");
export const DB_FILE = process.env.BRAIN_DB_FILE || defaultDbFile;

let db = null;

export const getDb = () => {
  if (db) return db;
  db = initDb();
  return db;
};

const initDb = () => {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const instance = new Database(DB_FILE);

  // Performance and safety pragmas
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.pragma("busy_timeout = 5000");
  instance.pragma("synchronous = NORMAL");

  // Create schema if needed
  createSchema(instance);

  return instance;
};

const createSchema = (db) => {
  db.exec(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Core memory entries (workingStyle, architecture, agentRules)
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL CHECK (section IN ('workingStyle', 'architecture', 'agentRules')),
      text TEXT NOT NULL,
      confidence TEXT DEFAULT 'tentative' CHECK (confidence IN ('firm', 'tentative')),
      source TEXT DEFAULT 'unknown',
      session_id TEXT,
      project TEXT DEFAULT '["general"]',
      tags TEXT DEFAULT '[]',
      annotations TEXT DEFAULT '[]',
      history TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_touched TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_section ON entries(section);
    CREATE INDEX IF NOT EXISTS idx_entries_session_id ON entries(session_id);
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_confidence ON entries(confidence);

    -- Decisions (special entries with status tracking)
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decision TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      confidence TEXT DEFAULT 'tentative' CHECK (confidence IN ('firm', 'tentative')),
      source TEXT DEFAULT 'unknown',
      session_id TEXT,
      project TEXT DEFAULT '["general"]',
      annotations TEXT DEFAULT '[]',
      history TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_touched TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
    CREATE INDEX IF NOT EXISTS idx_decisions_session_id ON decisions(session_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);

    -- Missions
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
    CREATE INDEX IF NOT EXISTS idx_missions_project ON missions(project);

    -- Mission tasks
    CREATE TABLE IF NOT EXISTS mission_tasks (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
      assigned_agent TEXT,
      session_id TEXT,
      output TEXT,
      blockers TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mission_tasks_mission_id ON mission_tasks(mission_id);
    CREATE INDEX IF NOT EXISTS idx_mission_tasks_status ON mission_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_mission_tasks_assigned_agent ON mission_tasks(assigned_agent);

    -- Reminders
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'snoozed')),
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
      due_date TEXT,
      snoozed_until TEXT,
      project TEXT DEFAULT '["general"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);

    -- Experiments
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'concluded', 'abandoned')),
      conclusion TEXT CHECK (conclusion IS NULL OR conclusion IN ('positive', 'negative', 'mixed')),
      project TEXT DEFAULT '["general"]',
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      concluded_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

    -- Experiment observations
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'negative', 'neutral')),
      source TEXT DEFAULT 'claude-session',
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_observations_experiment_id ON observations(experiment_id);

    -- Profiles
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      task_type TEXT DEFAULT '',
      project TEXT,
      sections TEXT DEFAULT '["workingStyle","architecture","agentRules","decisions"]',
      tags TEXT DEFAULT '[]',
      model TEXT DEFAULT '',
      role TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      constraints TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repos TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Webhooks
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      events TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Activity log
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      section TEXT NOT NULL,
      source TEXT DEFAULT 'unknown',
      session_id TEXT,
      value_summary TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_log_session_id ON activity_log(session_id);

    -- Archived entries (soft-delete)
    CREATE TABLE IF NOT EXISTS archived (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      text TEXT,
      decision TEXT,
      status TEXT,
      confidence TEXT,
      source TEXT,
      session_id TEXT,
      project TEXT DEFAULT '["general"]',
      annotations TEXT DEFAULT '[]',
      history TEXT DEFAULT '[]',
      created_at TEXT,
      last_touched TEXT,
      archived_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_archived_section ON archived(section);
  `);

  // Set initial schema version if not present
  const existing = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get();
  if (!existing) {
    db.prepare("INSERT INTO schema_meta (key, value) VALUES (?, ?)").run("schema_version", "1.0.0");
    db.prepare("INSERT INTO schema_meta (key, value) VALUES (?, ?)").run("created_at", new Date().toISOString());
  }

  // Schema migration: add status column to archived table (v1.0.1)
  const archivedCols = db.prepare("PRAGMA table_info(archived)").all().map(c => c.name);
  if (!archivedCols.includes("status")) {
    db.exec("ALTER TABLE archived ADD COLUMN status TEXT");
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.0.1");
    console.log("[brain-db] migrated archived table: added status column");
  }

  // Schema migration: add sessions table (v1.1.0)
  const sessionTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
  if (!sessionTableExists) {
    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        label TEXT,
        project TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        handoff TEXT
      );
      CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
      CREATE INDEX idx_sessions_project ON sessions(project);
    `);
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.1.0");
    console.log("[brain-db] migrated: added sessions table");
  }

  // Schema migration: add mission_templates table (v1.2.0)
  const templateTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mission_templates'").get();
  if (!templateTableExists) {
    db.exec(`
      CREATE TABLE mission_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        project TEXT,
        tasks TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_mission_templates_project ON mission_templates(project);
    `);
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.2.0");
    console.log("[brain-db] migrated: added mission_templates table");
  }

  // Schema migration: add locks table (v1.3.0)
  const locksTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='locks'").get();
  if (!locksTableExists) {
    db.exec(`
      CREATE TABLE locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file TEXT NOT NULL,
        agent TEXT NOT NULL,
        session_id TEXT,
        claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
      CREATE INDEX idx_locks_file ON locks(file);
      CREATE INDEX idx_locks_agent ON locks(agent);
      CREATE INDEX idx_locks_expires ON locks(expires_at);
    `);
    console.log("[brain-db] migrated: added locks table");
  }

  // Schema migration: add agent_results table (v1.3.0)
  const agentResultsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'").get();
  if (!agentResultsTableExists) {
    db.exec(`
      CREATE TABLE agent_results (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        session_id TEXT,
        mission_id TEXT,
        task_id TEXT,
        branch TEXT,
        worktree_path TEXT,
        changed_files TEXT DEFAULT '[]',
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_agent_results_agent ON agent_results(agent);
      CREATE INDEX idx_agent_results_session ON agent_results(session_id);
      CREATE INDEX idx_agent_results_mission ON agent_results(mission_id);
    `);
    console.log("[brain-db] migrated: added agent_results table");
  }

  // Schema migration: add blocked_by column to mission_tasks (v1.3.0)
  const taskCols = db.prepare("PRAGMA table_info(mission_tasks)").all().map(c => c.name);
  if (!taskCols.includes("blocked_by")) {
    db.exec("ALTER TABLE mission_tasks ADD COLUMN blocked_by TEXT DEFAULT '[]'");
    console.log("[brain-db] migrated mission_tasks: added blocked_by column");
  }

  // Update schema version to 1.3.0 if any v1.3.0 migrations ran
  if (!locksTableExists || !agentResultsTableExists || !taskCols.includes("blocked_by")) {
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.3.0");
  }

  // Schema migration: add audit_reports table (v1.4.0)
  const auditTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_reports'").get();
  if (!auditTableExists) {
    db.exec(`
      CREATE TABLE audit_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        trigger TEXT NOT NULL DEFAULT 'scheduled',
        summary TEXT NOT NULL,
        findings TEXT NOT NULL,
        dismissed TEXT DEFAULT '[]'
      );
      CREATE INDEX idx_audit_reports_created_at ON audit_reports(created_at DESC);
    `);
    console.log("[brain-db] migrated: added audit_reports table");
  }

  // Update schema version to 1.4.0 if v1.4.0 migration ran
  if (!auditTableExists) {
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.4.0");
  }

  // Schema migration: add title column to mission_tasks (v1.5.0)
  const taskCols150 = db.prepare("PRAGMA table_info(mission_tasks)").all().map(c => c.name);
  if (!taskCols150.includes("title")) {
    db.exec("ALTER TABLE mission_tasks ADD COLUMN title TEXT");
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.5.0");
    console.log("[brain-db] migrated mission_tasks: added title column (v1.5.0)");
  }

  // Schema migration: add phase column to mission_tasks, mission_notes table,
  // and recreate mission_tasks with updated CHECK constraint for 'interrupted' status (v1.6.0)
  const taskCols160 = db.prepare("PRAGMA table_info(mission_tasks)").all().map(c => c.name);
  const notesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mission_notes'").get();
  if (!taskCols160.includes("phase") || !notesTableExists) {
    // Add phase column if missing
    if (!taskCols160.includes("phase")) {
      db.exec("ALTER TABLE mission_tasks ADD COLUMN phase TEXT");
      console.log("[brain-db] migrated mission_tasks: added phase column");
    }

    // Recreate mission_tasks to update CHECK constraint (add 'interrupted' status)
    const currentCheck = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='mission_tasks'"
    ).get();
    if (currentCheck && !currentCheck.sql.includes("interrupted")) {
      db.exec(`
        CREATE TABLE mission_tasks_new (
          id TEXT PRIMARY KEY,
          mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'interrupted')),
          assigned_agent TEXT,
          session_id TEXT,
          output TEXT,
          blockers TEXT DEFAULT '[]',
          blocked_by TEXT DEFAULT '[]',
          title TEXT,
          phase TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          started_at TEXT,
          completed_at TEXT
        );
        INSERT INTO mission_tasks_new SELECT id, mission_id, description, status, assigned_agent, session_id, output, blockers, blocked_by, title, phase, created_at, started_at, completed_at FROM mission_tasks;
        DROP TABLE mission_tasks;
        ALTER TABLE mission_tasks_new RENAME TO mission_tasks;
        CREATE INDEX idx_mission_tasks_mission_id ON mission_tasks(mission_id);
        CREATE INDEX idx_mission_tasks_status ON mission_tasks(status);
        CREATE INDEX idx_mission_tasks_assigned_agent ON mission_tasks(assigned_agent);
      `);
      console.log("[brain-db] migrated mission_tasks: recreated with 'interrupted' in CHECK constraint");
    }

    // Create mission_notes table
    if (!notesTableExists) {
      db.exec(`
        CREATE TABLE mission_notes (
          id TEXT PRIMARY KEY,
          mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          session_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_mission_notes_mission_id ON mission_notes(mission_id);
      `);
      console.log("[brain-db] migrated: added mission_notes table");
    }

    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.6.0");
    console.log("[brain-db] schema version updated to 1.6.0");
  }

  // Schema migration: add observer_violations and agent_metrics tables (v1.7.0)
  const violationsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='observer_violations'").get();
  const agentMetricsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_metrics'").get();
  if (!violationsTableExists || !agentMetricsTableExists) {
    if (!violationsTableExists) {
      db.exec(`
        CREATE TABLE observer_violations (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          session_id TEXT,
          mission_id TEXT,
          task_id TEXT,
          violation_type TEXT NOT NULL CHECK (violation_type IN ('spiral_explorer', 'loop', 'late_output', 'stuck', 'role_violation')),
          details TEXT,
          severity TEXT DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
          action_taken TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_observer_violations_agent_name ON observer_violations(agent_name);
        CREATE INDEX idx_observer_violations_session_id ON observer_violations(session_id);
        CREATE INDEX idx_observer_violations_mission_id ON observer_violations(mission_id);
      `);
      console.log("[brain-db] migrated: added observer_violations table");
    }

    if (!agentMetricsTableExists) {
      db.exec(`
        CREATE TABLE agent_metrics (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          session_id TEXT,
          mission_id TEXT,
          task_id TEXT,
          tool_calls TEXT DEFAULT '{}',
          total_calls INTEGER DEFAULT 0,
          first_write_at TEXT,
          commit_count INTEGER DEFAULT 0,
          test_run_count INTEGER DEFAULT 0,
          test_pass_count INTEGER DEFAULT 0,
          test_fail_count INTEGER DEFAULT 0,
          violation_count INTEGER DEFAULT 0,
          duration_ms INTEGER DEFAULT 0,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_agent_metrics_agent_name ON agent_metrics(agent_name);
        CREATE INDEX idx_agent_metrics_session_id ON agent_metrics(session_id);
        CREATE INDEX idx_agent_metrics_mission_id ON agent_metrics(mission_id);
      `);
      console.log("[brain-db] migrated: added agent_metrics table");
    }

    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.7.0");
    console.log("[brain-db] schema version updated to 1.7.0");
  }

  // Schema migration: add verification columns to mission_tasks and 'verification_failed' status (v1.8.0)
  const taskCols180 = db.prepare("PRAGMA table_info(mission_tasks)").all().map(c => c.name);
  if (!taskCols180.includes("verification_command")) {
    // Add verification columns
    db.exec("ALTER TABLE mission_tasks ADD COLUMN verification_command TEXT");
    db.exec("ALTER TABLE mission_tasks ADD COLUMN verification_result TEXT");
    console.log("[brain-db] migrated mission_tasks: added verification_command and verification_result columns");

    // Recreate mission_tasks to update CHECK constraint (add 'verification_failed' status)
    const currentCheck180 = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='mission_tasks'"
    ).get();
    if (currentCheck180 && !currentCheck180.sql.includes("verification_failed")) {
      db.exec(`
        CREATE TABLE mission_tasks_new (
          id TEXT PRIMARY KEY,
          mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'interrupted', 'verification_failed')),
          assigned_agent TEXT,
          session_id TEXT,
          output TEXT,
          blockers TEXT DEFAULT '[]',
          blocked_by TEXT DEFAULT '[]',
          title TEXT,
          phase TEXT,
          verification_command TEXT,
          verification_result TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          started_at TEXT,
          completed_at TEXT
        );
        INSERT INTO mission_tasks_new SELECT id, mission_id, description, status, assigned_agent, session_id, output, blockers, blocked_by, title, phase, verification_command, verification_result, created_at, started_at, completed_at FROM mission_tasks;
        DROP TABLE mission_tasks;
        ALTER TABLE mission_tasks_new RENAME TO mission_tasks;
        CREATE INDEX idx_mission_tasks_mission_id ON mission_tasks(mission_id);
        CREATE INDEX idx_mission_tasks_status ON mission_tasks(status);
        CREATE INDEX idx_mission_tasks_assigned_agent ON mission_tasks(assigned_agent);
      `);
      console.log("[brain-db] migrated mission_tasks: recreated with 'verification_failed' in CHECK constraint");
    }

    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.8.0");
    console.log("[brain-db] schema version updated to 1.8.0");
  }

  // Schema migration: add experiment_id to missions (v1.9.0)
  const missionCols190 = db.prepare("PRAGMA table_info(missions)").all().map(c => c.name);
  if (!missionCols190.includes("experiment_id")) {
    db.exec("ALTER TABLE missions ADD COLUMN experiment_id TEXT");
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "1.9.0");
    console.log("[brain-db] schema version updated to 1.9.0 — missions.experiment_id");
  }

  // Schema migration: add session_activity table (v2.0.0)
  const sessionActivityExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_activity'").get();
  if (!sessionActivityExists) {
    db.exec(`
      CREATE TABLE session_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        activity_type TEXT NOT NULL CHECK (activity_type IN (
          'brain_query', 'brain_write', 'profile_inject', 'reviewer_run',
          'agent_spawn', 'commit'
        )),
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_session_activity_session ON session_activity(session_id);
      CREATE INDEX idx_session_activity_type ON session_activity(activity_type);
    `);
    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "2.0.0");
    console.log("[brain-db] migrated: added session_activity table (v2.0.0)");
  }

  // Schema migration: correlate violations to metric sessions by timestamp (v2.1.1)
  // Assigns each violation to the metric row whose time window contains it.
  // A metric row with created_at=T and duration_ms=D was active from T-D to T.
  const schemaVersion211 = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get();
  if (schemaVersion211 && schemaVersion211.value < "2.1.1") {
    // Reassign violation session IDs based on timestamp overlap with metric time windows
    db.exec(`
      UPDATE observer_violations
      SET session_id = (
        SELECT am.session_id FROM agent_metrics am
        WHERE am.agent_name = observer_violations.agent_name
        AND observer_violations.created_at >= datetime(am.created_at, '-' || (am.duration_ms / 1000) || ' seconds')
        AND observer_violations.created_at <= am.created_at
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM agent_metrics am
        WHERE am.agent_name = observer_violations.agent_name
        AND observer_violations.created_at >= datetime(am.created_at, '-' || (am.duration_ms / 1000) || ' seconds')
        AND observer_violations.created_at <= am.created_at
      );
    `);

    // Re-derive violation_count on all metric rows from actual violations
    db.exec(`
      UPDATE agent_metrics SET violation_count = (
        SELECT COUNT(*) FROM observer_violations
        WHERE session_id = agent_metrics.session_id
        AND agent_name = agent_metrics.agent_name
      );
    `);

    db.prepare("INSERT OR REPLACE INTO schema_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("schema_version", "2.1.1");
    console.log("[brain-db] migrated: timestamp-correlated violation session IDs (v2.1.1)");
  }

  // Ensure default "general" project exists
  const generalProject = db.prepare("SELECT id FROM projects WHERE id = 'general'").get();
  if (!generalProject) {
    db.prepare("INSERT INTO projects (id, name, repos, status) VALUES (?, ?, ?, ?)").run("general", "General", "[]", "active");
  }
};

// Backup: copy db to .bak with rotation
export const backupDb = () => {
  if (!db) return;
  try {
    const bakFile = DB_FILE + ".bak";
    // Rotate: .bak → .bak.1 → .bak.2
    try { fs.renameSync(bakFile + ".1", bakFile + ".2"); } catch {}
    try { fs.renameSync(bakFile, bakFile + ".1"); } catch {}
    db.backup(bakFile).then(() => {
      console.log(`[brain-db] backup created: ${bakFile}`);
    }).catch(err => {
      console.error(`[brain-db] backup failed: ${err.message}`);
    });
  } catch (err) {
    console.error(`[brain-db] backup rotation failed: ${err.message}`);
  }
};

// Start periodic backups (every 2 hours)
export const startBackupSchedule = () => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  setInterval(backupDb, TWO_HOURS);
  console.log("[brain-db] backup schedule started (every 2h)");
};

// Graceful shutdown
export const closeDb = () => {
  if (db) {
    db.close();
    db = null;
    console.log("[brain-db] database closed");
  }
};
