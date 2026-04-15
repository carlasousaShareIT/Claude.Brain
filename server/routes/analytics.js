// routes/analytics.js — analytics summary endpoint

import { Router } from "express";
import { getAnalyticsSummary } from "../db-store.js";

const router = Router();

// GET /analytics/summary — aggregate compliance, violations, project time, experiments
router.get("/summary", (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json(getAnalyticsSummary(limit));
});

export default router;
