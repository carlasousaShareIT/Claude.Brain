// routes/profiles.js — context profile CRUD

import { Router } from "express";
import { getProfiles, createProfile, updateProfile, deleteProfile, resolveProfile } from "../db-store.js";
import { broadcastEvent } from "../broadcast.js";

const router = Router();

// GET /memory/profiles/resolve — resolve subagent_type to profile
router.get("/memory/profiles/resolve", (req, res) => {
  const agentType = req.query.agentType || "";
  const profile = resolveProfile(agentType);
  if (!profile) return res.status(404).json({ error: "No profiles found" });
  res.json(profile);
});

// GET /memory/profiles
router.get("/memory/profiles", (req, res) => {
  res.json(getProfiles());
});

// POST /memory/profiles
router.post("/memory/profiles", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const profile = createProfile(req.body);
  broadcastEvent("profile-updated", { profile, ts: profile.createdAt });
  res.status(201).json(profile);
});

// PATCH /memory/profiles/:id
router.patch("/memory/profiles/:id", (req, res) => {
  const profile = updateProfile(req.params.id, req.body);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  broadcastEvent("profile-updated", { profile, ts: profile.updatedAt });
  res.json(profile);
});

// DELETE /memory/profiles/:id
router.delete("/memory/profiles/:id", (req, res) => {
  const deleted = deleteProfile(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Profile not found" });

  broadcastEvent("profile-updated", { deleted: req.params.id, ts: new Date().toISOString() });
  res.json({ ok: true });
});

export default router;
