// server/routes/auth.js — authentication endpoints mounted at /auth

import express from "express";
import { getDb } from "../db.js";
import {
  hashPassword, verifyPassword,
  generateApiToken, generateSessionId, sha256Hex,
} from "../auth-utils.js";
import { clearAuthCache } from "../middleware/auth.js";
import { ulid } from "ulid";

const router = express.Router();

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: COOKIE_MAX_AGE * 1000, // Express res.cookie expects ms
  secure: process.env.NODE_ENV === "production",
};

const isOwner = (req, res) => {
  if (!req.user?.isBootstrap) {
    res.status(403).json({ error: "Owner only" });
    return false;
  }
  return true;
};

// POST /auth/login — skips middleware (listed in skip-list in auth.js)
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toISOString().replace("T", " ").slice(0, 19);
    const ua = req.headers["user-agent"] || null;
    const ip = req.ip || null;

    db.prepare(`
      INSERT INTO web_sessions (id, user_id, expires_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, expiresAt, ua, ip);

    db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);

    res.cookie("brain_session", sessionId, COOKIE_OPTS);
    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name, isBootstrap: !!user.is_bootstrap },
      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) { next(err); }
});

// POST /auth/logout
router.post("/logout", (req, res, next) => {
  try {
    const sessionId = req.cookies?.brain_session;
    if (sessionId) {
      getDb().prepare("DELETE FROM web_sessions WHERE id = ?").run(sessionId);
      clearAuthCache({ userId: req.user?.id });
      res.clearCookie("brain_session", { path: "/" });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /auth/me
router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.user);
});

// PATCH /auth/me
router.patch("/me", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const db = getDb();
    const { displayName, email, currentPassword, newPassword } = req.body || {};

    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!row) return res.status(404).json({ error: "User not found" });

    if (newPassword) {
      if (!row.must_change_password) {
        if (!currentPassword) return res.status(400).json({ error: "currentPassword required" });
        const ok = await verifyPassword(currentPassword, row.password_hash);
        if (!ok) return res.status(401).json({ error: "Current password incorrect" });
      }
      const hash = await hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hash, row.id);
      clearAuthCache({ userId: row.id });
    }

    if (displayName) db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, row.id);
    if (email) db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, row.id);

    const updated = db.prepare("SELECT id, email, display_name, is_bootstrap, must_change_password FROM users WHERE id = ?").get(row.id);
    res.json({ id: updated.id, email: updated.email, displayName: updated.display_name, isBootstrap: !!updated.is_bootstrap });
  } catch (err) { next(err); }
});

// POST /auth/users — owner-only invite
router.post("/users", async (req, res, next) => {
  try {
    if (!isOwner(req, res)) return;
    const { email, displayName } = req.body || {};
    if (!email || !displayName) return res.status(400).json({ error: "email and displayName required" });

    const tempPassword = generateApiToken().slice(4); // reuse random bytes, strip brn_ prefix
    const hash = await hashPassword(tempPassword);
    const id = ulid();

    getDb().prepare(`
      INSERT INTO users (id, email, display_name, password_hash, must_change_password, status, invited_by)
      VALUES (?, ?, ?, ?, 1, 'active', ?)
    `).run(id, email, displayName, hash, req.user.id);

    res.status(201).json({
      user: { id, email, displayName, mustChangePassword: true },
      tempPassword,
    });
  } catch (err) { next(err); }
});

// GET /auth/users — owner-only list
router.get("/users", (req, res, next) => {
  try {
    if (!isOwner(req, res)) return;
    const rows = getDb().prepare(`
      SELECT id, email, display_name, status, invited_by, created_at, last_seen_at FROM users ORDER BY created_at
    `).all();
    res.json(rows.map(r => ({ id: r.id, email: r.email, displayName: r.display_name, status: r.status, invitedBy: r.invited_by, createdAt: r.created_at, lastSeenAt: r.last_seen_at })));
  } catch (err) { next(err); }
});

// PATCH /auth/users/:id — owner-only disable/enable/reset-password
router.patch("/users/:id", async (req, res, next) => {
  try {
    if (!isOwner(req, res)) return;
    const db = getDb();
    const { id } = req.params;
    const { status, resetPassword } = req.body || {};
    const row = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "User not found" });

    if (status) db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
    if (status) clearAuthCache({ userId: id });

    let tempPassword = null;
    if (resetPassword) {
      tempPassword = generateApiToken().slice(4);
      const hash = await hashPassword(tempPassword);
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hash, id);
      clearAuthCache({ userId: id });
    }

    res.json({ ok: true, ...(tempPassword ? { tempPassword } : {}) });
  } catch (err) { next(err); }
});

// GET /auth/tokens — caller's own tokens
router.get("/tokens", (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const rows = getDb().prepare(`
      SELECT id, name, token_prefix, scope, revoked_at, created_at, last_used_at
      FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      tokenPrefix: r.token_prefix,
      scope: r.scope,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    })));
  } catch (err) { next(err); }
});

// POST /auth/tokens — mint new token
router.post("/tokens", (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const { name, scope = "user" } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });

    const raw = generateApiToken();
    const hash = sha256Hex(raw);
    const prefix = raw.slice(0, 8);
    const id = ulid();

    getDb().prepare(`
      INSERT INTO api_tokens (id, user_id, name, token_prefix, token_hash, scope)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, prefix, hash, scope);

    res.status(201).json({ id, name, token_prefix: prefix, scope, token: raw });
  } catch (err) { next(err); }
});

// DELETE /auth/tokens/:id — revoke
router.delete("/tokens/:id", (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const db = getDb();
    const row = db.prepare("SELECT id, user_id FROM api_tokens WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Token not found" });
    if (row.user_id !== req.user.id && !req.user.isBootstrap) return res.status(403).json({ error: "Forbidden" });

    db.prepare("UPDATE api_tokens SET revoked_at = datetime('now') WHERE id = ?").run(req.params.id);
    clearAuthCache({ tokenId: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
