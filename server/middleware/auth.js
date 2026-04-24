// server/middleware/auth.js — dual-strategy auth (Bearer then cookie), passive/enforcing modes

import { getDb } from "../db.js";
import { sha256Hex } from "../auth-utils.js";

const CACHE_TTL_MS = 30_000;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Simple in-process LRU cache (Map preserves insertion order; we cap at 1000 entries)
const cache = new Map();
const CACHE_MAX = 1000;

const cacheGet = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.user;
};

const cacheSet = (key, user) => {
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { user, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const clearAuthCache = ({ userId, tokenId } = {}) => {
  if (!userId && !tokenId) { cache.clear(); return; }
  for (const [key, entry] of cache) {
    if (userId && entry.user?.id === userId) { cache.delete(key); continue; }
    if (tokenId && entry.user?.tokenId === tokenId) cache.delete(key);
  }
};

const SKIP_PATHS = ["/", "/auth/login"];
const SKIP_PREFIX = "/assets/";

const resolveBearer = (raw) => {
  const db = getDb();
  const hash = sha256Hex(raw);
  const cacheKey = `token:${hash}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const row = db.prepare(`
    SELECT t.id AS tokenId, t.user_id, t.scope,
           u.email, u.display_name, u.is_bootstrap, u.status, u.must_change_password
    FROM api_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL AND u.status = 'active'
  `).get(hash);
  if (!row) return null;

  // Update last_used_at (fire and forget — don't block request)
  db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.tokenId);

  const user = {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    isBootstrap: !!row.is_bootstrap,
    mustChangePassword: !!row.must_change_password,
    authStrategy: "token",
    tokenId: row.tokenId,
  };
  cacheSet(cacheKey, user);
  return user;
};

const resolveCookie = (sessionId) => {
  const db = getDb();
  const cacheKey = `cookie:${sha256Hex(sessionId)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const row = db.prepare(`
    SELECT ws.id AS sessionId, ws.user_id, ws.expires_at, ws.last_seen_at,
           u.email, u.display_name, u.is_bootstrap, u.status, u.must_change_password
    FROM web_sessions ws
    JOIN users u ON u.id = ws.user_id
    WHERE ws.id = ? AND ws.expires_at > datetime('now') AND u.status = 'active'
  `).get(sessionId);
  if (!row) return null;

  // Slide expiry if less than half TTL remains
  const expiresAt = new Date(row.expires_at).getTime();
  const halfTTL = SESSION_LIFETIME_MS / 2;
  if (expiresAt - Date.now() < halfTTL) {
    const newExpiry = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE web_sessions SET expires_at = ?, last_seen_at = datetime('now') WHERE id = ?").run(newExpiry, sessionId);
  } else {
    db.prepare("UPDATE web_sessions SET last_seen_at = datetime('now') WHERE id = ?").run(sessionId);
  }

  const user = {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    isBootstrap: !!row.is_bootstrap,
    mustChangePassword: !!row.must_change_password,
    authStrategy: "cookie",
    tokenId: null,
  };
  cacheSet(cacheKey, user);
  return user;
};

const getBootstrapUser = () => {
  const db = getDb();
  const row = db.prepare("SELECT id, email, display_name, is_bootstrap, must_change_password FROM users WHERE is_bootstrap = 1 LIMIT 1").get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isBootstrap: true,
    mustChangePassword: !!row.must_change_password,
    authStrategy: "passive",
    tokenId: null,
  };
};

export const authMiddleware = (req, res, next) => {
  // Skip static and login
  if (req.path === "/" || req.path.startsWith(SKIP_PREFIX)) return next();
  if (req.method === "POST" && req.path === "/auth/login") return next();

  const enforcing = process.env.BRAIN_AUTH === "1";

  // 1. Bearer token
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    const user = resolveBearer(raw);
    if (user) { req.user = user; return next(); }
    // Invalid token in enforcing mode → 401
    if (enforcing) {
      res.set("WWW-Authenticate", 'Bearer realm="brain"');
      res.set("X-Auth-Login-Path", "/auth/login");
      return res.status(401).json({ error: "Authentication required" });
    }
  }

  // 2. Cookie
  const sessionId = req.cookies?.brain_session;
  if (sessionId) {
    const user = resolveCookie(sessionId);
    if (user) { req.user = user; return next(); }
    if (enforcing) {
      res.set("WWW-Authenticate", 'Bearer realm="brain"');
      res.set("X-Auth-Login-Path", "/auth/login");
      return res.status(401).json({ error: "Authentication required" });
    }
  }

  // 3. No auth
  if (enforcing) {
    res.set("WWW-Authenticate", 'Bearer realm="brain"');
    res.set("X-Auth-Login-Path", "/auth/login");
    return res.status(401).json({ error: "Authentication required" });
  }

  // Passive mode: resolve as bootstrap user
  const bootstrap = getBootstrapUser();
  if (bootstrap) req.user = bootstrap;
  next();
};
