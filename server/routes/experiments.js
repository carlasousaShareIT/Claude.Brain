// routes/experiments.js — experiment CRUD + observations

import { Router } from "express";
import { loadBrain, saveBrain } from "../brain-store.js";
import { slugify } from "../text-utils.js";
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

  const now = new Date().toISOString();
  const brain = loadBrain();
  const existingIds = new Set((brain.experiments || []).map(e => e.id));
  const id = slugify(name, "e", existingIds);

  const experiment = {
    id,
    name,
    hypothesis,
    status: "active",
    conclusion: null,
    project: project ? (Array.isArray(project) ? project : [project]) : ["general"],
    sessionId: sessionId || null,
    createdAt: now,
    concludedAt: null,
    observations: [],
  };

  brain.experiments.push(experiment);
  saveBrain(brain);

  broadcastEvent("experiment-created", { experiment, ts: now });
  fireWebhooks(brain, "experiment-created", "experiments", experiment.name);
  console.log(`[brain] experiment created: ${experiment.id} — ${experiment.name}`);
  res.status(201).json(experiment);
});

// GET /experiments — list experiments
// Query: ?status=, ?project=
router.get("/", (req, res) => {
  const statusFilter = req.query.status || "";
  const projectFilter = req.query.project || "";

  const brain = loadBrain();
  let experiments = brain.experiments || [];

  if (statusFilter) {
    experiments = experiments.filter(e => e.status === statusFilter);
  }

  if (projectFilter) {
    experiments = experiments.filter(e => (e.project || []).includes(projectFilter));
  }

  const summary = experiments.map(e => {
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

  res.json(summary);
});

// GET /experiments/:id — single experiment with all observations
router.get("/:id", (req, res) => {
  const brain = loadBrain();
  const experiment = (brain.experiments || []).find(e => e.id === req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });
  res.json(experiment);
});

// PATCH /experiments/:id — update experiment
router.patch("/:id", (req, res) => {
  const brain = loadBrain();
  const experiment = (brain.experiments || []).find(e => e.id === req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  const { name, hypothesis, status, conclusion, project } = req.body;
  const now = new Date().toISOString();

  if (name !== undefined) experiment.name = name;
  if (hypothesis !== undefined) experiment.hypothesis = hypothesis;
  if (project !== undefined) experiment.project = Array.isArray(project) ? project : [project];

  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` });
    }
    experiment.status = status;
    if ((status === "concluded" || status === "abandoned") && !experiment.concludedAt) {
      experiment.concludedAt = now;
    }
  }

  if (conclusion !== undefined) {
    if (conclusion !== null && !VALID_CONCLUSIONS.has(conclusion)) {
      return res.status(400).json({ error: `Invalid conclusion "${conclusion}". Must be one of: ${[...VALID_CONCLUSIONS].join(", ")}` });
    }
    experiment.conclusion = conclusion;
  }

  saveBrain(brain);
  broadcastEvent("experiment-updated", { experiment, ts: now });
  fireWebhooks(brain, "experiment-updated", "experiments", experiment.name);
  console.log(`[brain] experiment updated: ${experiment.id} — status=${experiment.status}`);
  res.json(experiment);
});

// POST /experiments/:id/observations — add observation
router.post("/:id/observations", (req, res) => {
  const brain = loadBrain();
  const experiment = (brain.experiments || []).find(e => e.id === req.params.id);
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

  const now = new Date().toISOString();
  const existingObsIds = new Set((experiment.observations || []).map(o => o.id).filter(Boolean));
  const obsId = slugify(text, "o", existingObsIds);
  const observation = {
    id: obsId,
    text,
    sentiment: resolvedSentiment,
    sessionId: sessionId || null,
    source: source || "claude-session",
    createdAt: now,
  };

  experiment.observations.push(observation);
  saveBrain(brain);

  broadcastEvent("observation-added", { experimentId: experiment.id, observation, ts: now });
  fireWebhooks(brain, "observation-added", "experiments", text);
  console.log(`[brain] observation added to ${experiment.id}: ${text.slice(0, 80)}`);
  res.status(201).json(observation);
});

// PATCH /experiments/:id/observations/:obsId — update an observation
router.patch("/:id/observations/:obsId", (req, res) => {
  const brain = loadBrain();
  const experiment = (brain.experiments || []).find(e => e.id === req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  const observation = (experiment.observations || []).find(o => o.id === req.params.obsId);
  if (!observation) return res.status(404).json({ error: "Observation not found" });

  const { text, sentiment } = req.body;

  if (text !== undefined) observation.text = text;
  if (sentiment !== undefined) {
    if (!VALID_SENTIMENTS.has(sentiment)) {
      return res.status(400).json({ error: `Invalid sentiment "${sentiment}". Must be one of: ${[...VALID_SENTIMENTS].join(", ")}` });
    }
    observation.sentiment = sentiment;
  }

  saveBrain(brain);
  broadcastEvent("observation-updated", { experimentId: experiment.id, observation, ts: new Date().toISOString() });
  console.log(`[brain] observation updated: ${observation.id} in ${experiment.id}`);
  res.json(observation);
});

// DELETE /experiments/:id/observations/:obsId — delete an observation
router.delete("/:id/observations/:obsId", (req, res) => {
  const brain = loadBrain();
  const experiment = (brain.experiments || []).find(e => e.id === req.params.id);
  if (!experiment) return res.status(404).json({ error: "Experiment not found" });

  const idx = (experiment.observations || []).findIndex(o => o.id === req.params.obsId);
  if (idx === -1) return res.status(404).json({ error: "Observation not found" });

  const removed = experiment.observations.splice(idx, 1)[0];
  saveBrain(brain);
  broadcastEvent("observation-deleted", { experimentId: experiment.id, obsId: removed.id, ts: new Date().toISOString() });
  console.log(`[brain] observation deleted: ${removed.id} from ${experiment.id}`);
  res.json({ ok: true });
});

// DELETE /experiments/:id — delete experiment
router.delete("/:id", (req, res) => {
  const brain = loadBrain();
  const idx = (brain.experiments || []).findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Experiment not found" });

  const removed = brain.experiments.splice(idx, 1)[0];
  saveBrain(brain);
  broadcastEvent("experiment-deleted", { id: removed.id, deleted: true, ts: new Date().toISOString() });
  fireWebhooks(brain, "experiment-deleted", "experiments", removed.name);
  console.log(`[brain] experiment deleted: ${removed.id} — ${removed.name}`);
  res.json({ ok: true });
});

export default router;
