// routes/experiments.js — experiment CRUD + observations

import { Router } from "express";
import {
  createExperiment,
  getExperiments,
  getExperiment,
  updateExperiment,
  deleteExperiment,
  addObservation,
  updateObservation,
  deleteObservation,
  getExperimentEffectiveness,
  getWebhooks,
} from "../db-store.js";
import { fireWebhooks, broadcastEvent } from "../broadcast.js";

const VALID_STATUSES = new Set(["active", "concluded", "abandoned"]);
const VALID_CONCLUSIONS = new Set(["positive", "negative", "mixed"]);
const VALID_SENTIMENTS = new Set(["positive", "negative", "neutral"]);

const router = Router();

// POST /experiments — create an experiment
router.post("/", (req, res) => {
  const { name, hypothesis, project, sessionId } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });
  if (!hypothesis) return res.status(400).json({ error: "Missing hypothesis" });

  const experiment = createExperiment({ name, hypothesis, project, sessionId });
  const now = new Date().toISOString();

  broadcastEvent("experiment-created", { experiment, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "experiment-created", "experiments", experiment.name);
  console.log(`[brain] experiment created: ${experiment.id} — ${experiment.name}`);
  res.status(201).json(experiment);
});

// GET /experiments — list experiments
// Query: ?status=, ?project=
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "";
  const projectFilter = req.query.project || "";
  const summary = getExperiments(statusFilter, projectFilter);
  res.json(summary);
});

// GET /experiments/:id/effectiveness — before/after comparison
router.get("/:id/effectiveness", (req, res) => {
  const result = getExperimentEffectiveness(req.params.id);
  if (!result) return res.status(404).json({ error: "Experiment not found" });
  res.json(result);
});

// GET /experiments/:id — single experiment with all observations
router.get("/:id", (req, res) => {
  const experiment = getExperiment(req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });
  res.json(experiment);
});

// PATCH /experiments/:id — update experiment
router.patch("/:id", (req, res) => {
  const { name, hypothesis, status, conclusion, project } = req.body;

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` });
  }

  if (conclusion !== undefined && conclusion !== null && !VALID_CONCLUSIONS.has(conclusion)) {
    return res.status(400).json({ error: `Invalid conclusion "${conclusion}". Must be one of: ${[...VALID_CONCLUSIONS].join(", ")}` });
  }

  const experiment = updateExperiment(req.params.id, { name, hypothesis, status, conclusion, project });
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  const now = new Date().toISOString();
  broadcastEvent("experiment-updated", { experiment, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "experiment-updated", "experiments", experiment.name);
  console.log(`[brain] experiment updated: ${experiment.id} — status=${experiment.status}`);
  res.json(experiment);
});

// POST /experiments/:id/observations — add observation
router.post("/:id/observations", (req, res) => {
  const experiment = getExperiment(req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  if (experiment.status !== "active") {
    return res.status(400).json({ error: `Cannot add observations to a ${experiment.status} experiment` });
  }

  const { text, sentiment, sessionId, source } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const resolvedSentiment = sentiment || "neutral";
  if (!VALID_SENTIMENTS.has(resolvedSentiment)) {
    return res.status(400).json({ error: `Invalid sentiment "${resolvedSentiment}". Must be one of: ${[...VALID_SENTIMENTS].join(", ")}` });
  }

  const observation = addObservation(req.params.id, {
    text, sentiment: resolvedSentiment, sessionId, source,
  });
  const now = new Date().toISOString();

  broadcastEvent("observation-added", { experimentId: req.params.id, observation, ts: now });
  fireWebhooks({ webhooks: getWebhooks() }, "observation-added", "experiments", text);
  console.log(`[brain] observation added to ${req.params.id}: ${text.slice(0, 80)}`);
  res.status(201).json(observation);
});

// PATCH /experiments/:id/observations/:obsId — update an observation
router.patch("/:id/observations/:obsId", (req, res) => {
  const { text, sentiment } = req.body;

  if (sentiment !== undefined && !VALID_SENTIMENTS.has(sentiment)) {
    return res.status(400).json({ error: `Invalid sentiment "${sentiment}". Must be one of: ${[...VALID_SENTIMENTS].join(", ")}` });
  }

  const observation = updateObservation(req.params.id, req.params.obsId, { text, sentiment });
  if (!observation) {
    // Determine whether experiment or observation is missing
    const experiment = getExperiment(req.params.id);
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    return res.status(404).json({ error: "Observation not found" });
  }

  broadcastEvent("observation-updated", { experimentId: req.params.id, observation, ts: new Date().toISOString() });
  console.log(`[brain] observation updated: ${observation.id} in ${req.params.id}`);
  res.json(observation);
});

// DELETE /experiments/:id/observations/:obsId — delete an observation
router.delete("/:id/observations/:obsId", (req, res) => {
  const experiment = getExperiment(req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  const obsExists = (experiment.observations || []).some(o => o.id === req.params.obsId);
  if (!obsExists) return res.status(404).json({ error: "Observation not found" });

  deleteObservation(req.params.id, req.params.obsId);
  broadcastEvent("observation-deleted", { experimentId: req.params.id, obsId: req.params.obsId, ts: new Date().toISOString() });
  console.log(`[brain] observation deleted: ${req.params.obsId} from ${req.params.id}`);
  res.json({ ok: true });
});

// DELETE /experiments/:id — delete experiment
router.delete("/:id", (req, res) => {
  const existing = getExperiment(req.params.id);
  if (!existing) return res.status(404).json({ error: "Experiment not found" });

  deleteExperiment(req.params.id);
  broadcastEvent("experiment-deleted", { id: existing.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks({ webhooks: getWebhooks() }, "experiment-deleted", "experiments", existing.name);
  console.log(`[brain] experiment deleted: ${existing.id} — ${existing.name}`);
  res.json({ ok: true });
});

export default router;
