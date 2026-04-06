// routes/audit.js — brain health audit endpoints

import { Router } from "express";
import {
  runBrainAudit,
  getAuditReports,
  getLatestAuditReport,
  dismissAuditFinding,
  promoteDecisionToArchitecture,
  mergeDuplicateEntries,
} from "../brain-audit.js";

const router = Router();

// GET /audit/reports — list audit reports
router.get("/reports", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const reports = getAuditReports(limit);
  res.json(reports);
});

// GET /audit/reports/latest — latest audit report
router.get("/reports/latest", (req, res) => {
  const report = getLatestAuditReport();
  if (!report) return res.status(404).json({ error: "No audit reports found" });
  res.json(report);
});

// POST /audit/run — trigger a manual audit
router.post("/run", (req, res, next) => {
  try {
    const report = runBrainAudit("manual");
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// POST /audit/dismiss — dismiss a finding
router.post("/dismiss", (req, res, next) => {
  try {
    const { reportId, findingId } = req.body;
    if (!reportId || !findingId) {
      return res.status(400).json({ error: "Missing reportId or findingId" });
    }
    const report = dismissAuditFinding(reportId, findingId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// POST /audit/promote — promote a decision to architecture
router.post("/promote", (req, res, next) => {
  try {
    const { decisionId } = req.body;
    if (!decisionId) {
      return res.status(400).json({ error: "Missing decisionId" });
    }
    const result = promoteDecisionToArchitecture(decisionId);
    if (!result.ok) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /audit/merge — merge two duplicate entries
router.post("/merge", (req, res, next) => {
  try {
    const { keepSection, keepText, archiveSection, archiveText } = req.body;
    if (!keepSection || !keepText || !archiveSection || !archiveText) {
      return res.status(400).json({ error: "Missing keepSection, keepText, archiveSection, or archiveText" });
    }
    const result = mergeDuplicateEntries(keepSection, keepText, archiveSection, archiveText);
    if (!result.ok) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
