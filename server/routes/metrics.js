// routes/metrics.js — brain health stats

import { Router } from "express";
import { getMetrics } from "../db-store.js";

const router = Router();

// GET /memory/metrics — brain health stats
router.get("/memory/metrics", (req, res) => {
  const projectId = req.query.project || "";
  res.json(getMetrics(projectId));
});

export default router;
