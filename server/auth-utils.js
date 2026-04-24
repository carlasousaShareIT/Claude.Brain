// server/auth-utils.js — crypto primitives and authz helpers for brain-app auth

import crypto from "crypto";
import argon2 from "argon2";
import { getDb } from "./db.js";

// ---------------------------------------------------------------------------
// Crypto primitives
// ---------------------------------------------------------------------------

export const sha256Hex = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

// brn_<22-char base64url> — 16 bytes = exactly 22 base64url chars
export const generateApiToken = () =>
  "brn_" + crypto.randomBytes(16).toString("base64url");

// 32-byte opaque session ID stored plain (HttpOnly cookie, never exposed to JS)
export const generateSessionId = () =>
  crypto.randomBytes(32).toString("base64url");

// Argon2id — OWASP 2023 baseline parameters
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain) => argon2.hash(plain, ARGON2_OPTIONS);

export const verifyPassword = (plain, hash) => argon2.verify(hash, plain);

// ---------------------------------------------------------------------------
// Authz helpers — mirror json_each pattern from db-store.js:257
// ---------------------------------------------------------------------------

export const userCanReadProject = (userId, projectId) => {
  const db = getDb();
  // general is readable by any active user (MVP)
  if (projectId === "general") {
    const user = db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(userId);
    return !!user;
  }
  const row = db.prepare(`
    SELECT 1 FROM projects p
    WHERE p.id = ?
      AND (
        p.owner_user_id = ?
        OR EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id AND ps.user_id = ?
        )
      )
  `).get(projectId, userId, userId);
  return !!row;
};

export const userCanWriteProject = (userId, projectId) => {
  const db = getDb();
  if (projectId === "general") {
    // general is shared read for all active users in MVP; write requires ownership
    const row = db.prepare("SELECT owner_user_id FROM projects WHERE id = 'general'").get();
    return row && row.owner_user_id === userId;
  }
  const row = db.prepare(`
    SELECT 1 FROM projects p
    WHERE p.id = ?
      AND (
        p.owner_user_id = ?
        OR EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id AND ps.user_id = ? AND ps.permission = 'write'
        )
      )
  `).get(projectId, userId, userId);
  return !!row;
};

export const userCanReadAnyProject = (userId, projectIds) =>
  projectIds.some((id) => userCanReadProject(userId, id));

export const userCanWriteAnyProject = (userId, projectIds) =>
  projectIds.some((id) => userCanWriteProject(userId, id));

export const accessibleProjectIds = (userId) => {
  const db = getDb();
  const owned = db.prepare("SELECT id FROM projects WHERE owner_user_id = ?").all(userId).map(r => r.id);
  const shared = db.prepare("SELECT project_id FROM project_shares WHERE user_id = ?").all(userId).map(r => r.project_id);
  const ids = new Set([...owned, ...shared, "general"]);
  return [...ids];
};

// Returns { sql, binds } for a WHERE clause that filters rows to projects
// accessible by userId. tableAlias.projectCol is the JSON array column.
// Mirrors the json_each pattern from db-store.js:257.
export const projectFilterSqlForUser = (userId, tableAlias, projectCol) => {
  const col = tableAlias ? `${tableAlias}.${projectCol}` : projectCol;
  const sql = `EXISTS (
    SELECT 1 FROM json_each(${col}) AS je
    WHERE je.value IN (
      SELECT p.id FROM projects p
      WHERE p.owner_user_id = ?
      UNION
      SELECT ps.project_id FROM project_shares ps WHERE ps.user_id = ?
      UNION SELECT 'general'
    )
  )`;
  return { sql, binds: [userId, userId] };
};
