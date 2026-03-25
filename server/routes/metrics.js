// routes/metrics.js — brain health stats

import { Router } from "express";
import { loadBrain } from "../brain-store.js";
import { entryText, filterByProject } from "../entry-utils.js";

const router = Router();

// GET /memory/metrics — brain health stats
router.get("/memory/metrics", (req, res) => {
  const projectId = req.query.project || "";
  const rawBrain = loadBrain();
  const brain = projectId ? filterByProject(rawBrain, projectId) : rawBrain;
  const sections = ["workingStyle", "architecture", "agentRules", "decisions"];
  const bySection = {};
  const byConfidence = { firm: 0, tentative: 0 };
  const byStatus = { open: 0, resolved: 0 };
  let totalEntries = 0;
  let totalAgeDays = 0;
  let oldestEntry = null;
  let newestEntry = null;
  const sessionIds = new Set();
  let annotationsCount = 0;

  const now = Date.now();

  for (const section of sections) {
    const list = brain[section] || [];
    bySection[section] = list.length;
    totalEntries += list.length;

    for (const entry of list) {
      const obj = typeof entry === "object" ? entry : {};
      const text = entryText(entry);
      const createdAt = obj.createdAt || null;

      if (obj.confidence === "firm") byConfidence.firm++;
      else byConfidence.tentative++;

      if (section === "decisions") {
        if (obj.status === "resolved") byStatus.resolved++;
        else byStatus.open++;
      }

      if (createdAt) {
        const ageDays = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        totalAgeDays += ageDays;
        if (!oldestEntry || createdAt < oldestEntry.createdAt) oldestEntry = { text, section, createdAt };
        if (!newestEntry || createdAt > newestEntry.createdAt) newestEntry = { text, section, createdAt };
      }

      if (obj.sessionId) sessionIds.add(obj.sessionId);
      if (obj.annotations) annotationsCount += obj.annotations.length;
    }
  }

  // Activity by day from log (last 30 days)
  const activityByDay = {};
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const logEntry of (brain.log || [])) {
    if (!logEntry.ts) continue;
    const day = logEntry.ts.slice(0, 10);
    if (day >= thirtyDaysAgo) {
      activityByDay[day] = (activityByDay[day] || 0) + 1;
    }
  }

  res.json({
    totalEntries,
    bySection,
    byConfidence,
    byStatus,
    archived: (brain.archived || []).length,
    avgAgeDays: totalEntries > 0 ? Math.round(totalAgeDays / totalEntries) : 0,
    oldestEntry,
    newestEntry,
    sessionsCount: sessionIds.size,
    annotationsCount,
    activityByDay,
  });
});

export default router;
