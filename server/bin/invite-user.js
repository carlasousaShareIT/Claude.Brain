#!/usr/bin/env node
// server/bin/invite-user.js — CLI to create a user row directly in brain.db
// Usage: node server/bin/invite-user.js --email x@y.com --display-name "Name" [--mint-token]

import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import os from "os";
import { ulid } from "ulid";

// Resolve imports relative to project root (two levels up from server/bin/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// Dynamically import auth-utils from server/ — must be adjacent to this file's parent
const { hashPassword, generateApiToken, sha256Hex } = await import(
  path.join(projectRoot, "server/auth-utils.js")
);

// ---------------------------------------------------------------------------
// Arg parsing — no external deps
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const get = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const has = (flag) => args.includes(flag);

const email = get("--email");
const displayName = get("--display-name");
const mintToken = has("--mint-token");

if (!email || !displayName) {
  process.stderr.write(
    "Usage: node server/bin/invite-user.js --email <email> --display-name <name> [--mint-token]\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Open DB
// ---------------------------------------------------------------------------

const dbFile = process.env.BRAIN_DB_FILE || path.join(os.homedir(), ".claude", "brain.db");
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ---------------------------------------------------------------------------
// Schema guard — require v2.5.0 tables
// ---------------------------------------------------------------------------

const usersExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  .get();
const tokensExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_tokens'")
  .get();

if (!usersExists || !tokensExists) {
  process.stderr.write(
    "Error: required tables (users, api_tokens) not found.\n" +
      "Start the brain server once to run schema migrations, then retry.\n"
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Generate credentials
// ---------------------------------------------------------------------------

const tempPassword = crypto.randomBytes(9).toString("base64url");
const passwordHash = await hashPassword(tempPassword);
const userId = ulid();
const now = new Date().toISOString().replace("T", " ").slice(0, 19);

// ---------------------------------------------------------------------------
// Insert user
// ---------------------------------------------------------------------------

let userRow;
try {
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, must_change_password, status, is_bootstrap, invited_by, created_at)
    VALUES (?, ?, ?, ?, 1, 'active', 0, NULL, ?)
  `).run(userId, email, displayName, passwordHash, now);

  userRow = { id: userId, email, display_name: displayName, status: "active", created_at: now };
} catch (err) {
  if (err.message && err.message.includes("UNIQUE constraint failed: users.email")) {
    process.stderr.write(`Error: a user with email "${email}" already exists.\n`);
    process.exit(3);
  }
  process.stderr.write(`Error inserting user: ${err.message}\n`);
  process.exit(4);
}

// ---------------------------------------------------------------------------
// Optionally mint an API token
// ---------------------------------------------------------------------------

let rawToken = null;
if (mintToken) {
  rawToken = generateApiToken();
  const tokenHash = sha256Hex(rawToken);
  const tokenPrefix = rawToken.slice(0, 8);
  const tokenId = ulid();

  db.prepare(`
    INSERT INTO api_tokens (id, user_id, name, token_prefix, token_hash, scope, created_at)
    VALUES (?, ?, 'bootstrap-cli', ?, ?, 'user', ?)
  `).run(tokenId, userId, tokenPrefix, tokenHash, now);

  // Print raw token to stdout exactly once before the JSON payload
  process.stdout.write(`token: ${rawToken}\n`);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const output = { user: userRow, tempPassword };
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
process.exit(0);
