// brain-audit.js — brain health audit system

import { tokenize, similarity, slugify, combinedSimilarity, semanticNormalize } from "./text-utils.js";
import { getDb } from "./db.js";
import { broadcastEvent } from "./broadcast.js";
import { addEntry, updateEntry, updateDecision, archiveEntry, resolveDecision, isEntryReferencedByMission } from "./db-store.js";

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

const daysBetween = (dateStr) => {
  const then = new Date(dateStr);
  const diff = Date.now() - then.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

function findDuplicates() {
  const db = getDb();
  const entries = db.prepare("SELECT id, section, text FROM entries").all();
  const decisions = db.prepare("SELECT id, decision AS text FROM decisions").all()
    .map(d => ({ ...d, section: "decisions", isDecision: true }));

  const all = [...entries, ...decisions];
  const findings = [];
  const seen = new Set();

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const sim = combinedSimilarity(all[i].text, all[j].text);
      const pairKey = `${all[i].section}-${all[i].id}__${all[j].section}-${all[j].id}`;

      if (sim >= 0.45) {
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        findings.push({
          id: `duplicate-${pairKey}`,
          type: "duplicate",
          severity: "warning",
          section: all[i].section,
          entryId: all[i].id,
          text: all[i].text,
          detail: `Duplicate of (${all[j].section}): ${all[j].text}`,
          relatedEntryId: all[j].id,
          relatedSection: all[j].section,
          relatedText: all[j].text,
          similarity: Math.round(sim * 100) / 100,
        });
      } else {
        // Substring detection for entries that share content but have low token similarity
        const normA = semanticNormalize(all[i].text);
        const normB = semanticNormalize(all[j].text);
        const isSubstring = normA.length > 20 && normB.length > 20 &&
          (normA.includes(normB) || normB.includes(normA));
        if (isSubstring) {
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          findings.push({
            id: `duplicate-${pairKey}`,
            type: "duplicate",
            severity: "warning",
            section: all[i].section,
            entryId: all[i].id,
            text: all[i].text,
            detail: `Substring duplicate of (${all[j].section}): ${all[j].text}`,
            relatedEntryId: all[j].id,
            relatedSection: all[j].section,
            relatedText: all[j].text,
            similarity: 0.5,
          });
        }
      }
    }
  }
  return findings;
}

function findStaleEntries() {
  const db = getDb();
  const findings = [];

  const staleEntries = db.prepare(
    "SELECT id, section, text, last_touched FROM entries WHERE confidence = 'tentative' AND last_touched < datetime('now', '-14 days')"
  ).all();

  for (const e of staleEntries) {
    findings.push({
      id: `stale-${e.section}-${e.id}`,
      type: "stale",
      severity: "info",
      section: e.section,
      entryId: e.id,
      text: e.text,
      detail: `Tentative entry untouched for ${daysBetween(e.last_touched)} days`,
      ageDays: daysBetween(e.last_touched),
    });
  }

  const staleDecisions = db.prepare(
    "SELECT id, decision AS text, last_touched FROM decisions WHERE confidence = 'tentative' AND last_touched < datetime('now', '-14 days')"
  ).all();

  for (const d of staleDecisions) {
    findings.push({
      id: `stale-decisions-${d.id}`,
      type: "stale",
      severity: "info",
      section: "decisions",
      entryId: d.id,
      text: d.text,
      detail: `Tentative decision untouched for ${daysBetween(d.last_touched)} days`,
      ageDays: daysBetween(d.last_touched),
    });
  }

  return findings;
}

function findNoiseEntries() {
  const db = getDb();
  const entries = db.prepare(
    "SELECT id, section, text, confidence, annotations, session_id, created_at, history FROM entries"
  ).all();
  const findings = [];

  const TEMPORAL_RE = /\b(today|right now|this sprint|this week|yesterday|tomorrow)\b/i;
  const PATH_RE = /^(C:\\|\/home\/|\/Users\/|\/tmp\/)/;

  for (const e of entries) {
    const reasons = [];

    if (e.text.length < 20) {
      reasons.push("too short (< 20 chars)");
    }

    if (PATH_RE.test(e.text)) {
      reasons.push("absolute file path");
    }

    if (TEMPORAL_RE.test(e.text) && daysBetween(e.created_at) > 14) {
      reasons.push("stale temporal language");
    }

    // Single-session tentative entry older than 30 days with no annotations
    if (e.confidence === "tentative" && daysBetween(e.created_at) > 30) {
      let annotations;
      try { annotations = JSON.parse(e.annotations || "[]"); } catch { annotations = []; }
      const emptyAnnotations = !annotations || annotations.length === 0;
      // No history edits means only one session ever touched it
      let history;
      try { history = JSON.parse(e.history || "[]"); } catch { history = []; }
      if (emptyAnnotations && history.length === 0) {
        reasons.push("single-session tentative entry older than 30 days");
      }
    }

    if (reasons.length > 0) {
      findings.push({
        id: `noise-${e.section}-${e.id}`,
        type: "noise",
        severity: "info",
        section: e.section,
        entryId: e.id,
        text: e.text,
        detail: reasons.join("; "),
      });
    }
  }
  return findings;
}

function findPromotableDecisions() {
  const db = getDb();
  const firmResolved = db.prepare(
    "SELECT id, decision, project FROM decisions WHERE status = 'resolved' AND confidence = 'firm'"
  ).all();
  const archEntries = db.prepare("SELECT id, text FROM entries WHERE section = 'architecture'").all();

  const findings = [];
  for (const d of firmResolved) {
    const tokD = tokenize(d.decision);
    let hasMatch = false;
    for (const a of archEntries) {
      const tokA = tokenize(a.text);
      if (similarity(tokD, tokA) > 0.4) {
        hasMatch = true;
        break;
      }
    }
    if (!hasMatch) {
      findings.push({
        id: `promotable-decisions-${d.id}`,
        type: "promotable",
        severity: "info",
        section: "decisions",
        entryId: d.id,
        text: d.decision,
        detail: "Firm resolved decision not yet captured in architecture",
      });
    }
  }
  return findings;
}

function findAgingDecisions() {
  const db = getDb();
  const aging = db.prepare(
    "SELECT id, decision AS text, created_at FROM decisions WHERE status = 'open' AND created_at < datetime('now', '-14 days')"
  ).all();

  return aging.map(d => ({
    id: `aging_decision-decisions-${d.id}`,
    type: "aging_decision",
    severity: "warning",
    section: "decisions",
    entryId: d.id,
    text: d.text,
    detail: `Open decision aging for ${daysBetween(d.created_at)} days`,
    ageDays: daysBetween(d.created_at),
  }));
}

// ---------------------------------------------------------------------------
// Core audit
// ---------------------------------------------------------------------------

export function runBrainAudit(trigger = "scheduled") {
  const db = getDb();
  const ts = now();

  // Run all detectors
  const duplicates = findDuplicates();
  const stale = findStaleEntries();
  const noise = findNoiseEntries();
  const promotable = findPromotableDecisions();
  const agingDecisions = findAgingDecisions();

  const findings = [...duplicates, ...stale, ...noise, ...promotable, ...agingDecisions];

  // Auto-actions: archive stale, promote decisions, merge duplicates
  const autoActions = [];

  // Auto-archive stale tentative entries older than 30 days
  for (const finding of [...stale, ...noise]) {
    if (finding.type === "stale" && finding.ageDays >= 30) {
      if (!isEntryReferencedByMission(finding.text)) {
        archiveEntry(finding.section, finding.text);
        autoActions.push({ type: "auto-archive", entryId: finding.entryId, reason: `Stale tentative entry (${finding.ageDays} days)` });
      }
    }
    if (finding.type === "noise" && finding.detail.includes("single-session tentative entry older than 30 days")) {
      if (!isEntryReferencedByMission(finding.text)) {
        archiveEntry(finding.section, finding.text);
        autoActions.push({ type: "auto-archive", entryId: finding.entryId, reason: "Single-session noise entry" });
      }
    }
  }

  // Auto-promote firm resolved decisions older than 14 days
  for (const finding of promotable) {
    const db2 = getDb();
    const decision = db2.prepare("SELECT * FROM decisions WHERE id = ?").get(finding.entryId);
    if (decision && daysBetween(decision.created_at) >= 14) {
      const result = promoteDecisionToArchitecture(finding.entryId);
      if (result.ok) {
        autoActions.push({ type: "auto-promote", entryId: finding.entryId, reason: "Firm resolved decision aged 14+ days" });
      }
    }
  }

  // Auto-merge high-confidence duplicates
  for (const finding of duplicates) {
    if (finding.similarity >= 0.8) {
      const keepText = finding.text.length >= finding.relatedText.length ? finding.text : finding.relatedText;
      const keepSection = finding.text.length >= finding.relatedText.length ? finding.section : finding.relatedSection;
      const archiveText = keepText === finding.text ? finding.relatedText : finding.text;
      const archiveSection = keepText === finding.text ? finding.relatedSection : finding.section;
      const result = mergeDuplicateEntries(keepSection, keepText, archiveSection, archiveText);
      if (result.ok) {
        autoActions.push({ type: "auto-merge", entryId: finding.entryId, reason: `Duplicate similarity ${finding.similarity}` });
      }
    }
  }

  // Log auto-actions to activity_log
  for (const action of autoActions) {
    db.prepare(
      "INSERT INTO activity_log (timestamp, action, section, source, session_id, value_summary) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(ts, action.type, "brain", "brain-audit-auto", null, `${action.type}: ${action.reason}`);
  }

  // Carry forward dismissed findings from latest report
  let dismissed = [];
  const latestRow = db.prepare("SELECT dismissed FROM audit_reports ORDER BY created_at DESC LIMIT 1").get();
  if (latestRow) {
    try {
      const prevDismissed = JSON.parse(latestRow.dismissed || "[]");
      const findingIds = new Set(findings.map(f => f.id));
      dismissed = prevDismissed.filter(id => findingIds.has(id));
    } catch {}
  }

  // Build summary
  const summary = {
    duplicates: duplicates.length,
    stale: stale.length,
    noise: noise.length,
    promotable: promotable.length,
    agingDecisions: agingDecisions.length,
    total: findings.length,
    autoActions: autoActions.length,
    autoActionDetails: autoActions,
  };

  // Persist report
  const result = db.prepare(
    "INSERT INTO audit_reports (created_at, trigger, summary, findings, dismissed) VALUES (?, ?, ?, ?, ?)"
  ).run(ts, trigger, JSON.stringify(summary), JSON.stringify(findings), JSON.stringify(dismissed));

  const reportId = result.lastInsertRowid;

  // Broadcast SSE event
  broadcastEvent("brain-audit", { reportId, summary, ts });

  // Create a reminder (complete any existing pending audit reminders first)
  db.prepare(
    "UPDATE reminders SET status = 'done', completed_at = ? WHERE status = 'pending' AND text LIKE 'Brain health audit completed%'"
  ).run(ts);
  const existingReminders = db.prepare("SELECT id FROM reminders").all();
  const existingIds = new Set(existingReminders.map(r => r.id));
  const reminderId = slugify("brain health audit review", "r", existingIds);
  db.prepare(
    "INSERT INTO reminders (id, text, status, priority, due_date, project, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    reminderId,
    "Brain health audit completed — review findings at http://localhost:5173",
    "pending",
    "normal",
    ts,
    '["brain-app"]',
    ts
  );

  // Log to activity_log
  db.prepare(
    "INSERT INTO activity_log (timestamp, action, section, source, session_id, value_summary) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(ts, "audit", "brain", "brain-audit", null, `Audit completed: ${summary.total} findings`);

  const report = {
    id: reportId,
    createdAt: ts,
    trigger,
    summary,
    findings,
    dismissed,
    autoActions,
  };

  console.log(`[brain-audit] completed (${trigger}): ${summary.total} findings, ${autoActions.length} auto-actions`);
  return report;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getAuditReports(limit = 10) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM audit_reports ORDER BY created_at DESC LIMIT ?").all(limit);
  return rows.map(r => ({
    id: r.id,
    createdAt: r.created_at,
    trigger: r.trigger,
    summary: JSON.parse(r.summary),
    findings: JSON.parse(r.findings),
    dismissed: JSON.parse(r.dismissed || "[]"),
  }));
}

export function getLatestAuditReport() {
  const db = getDb();
  const row = db.prepare("SELECT * FROM audit_reports ORDER BY created_at DESC LIMIT 1").get();
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    trigger: row.trigger,
    summary: JSON.parse(row.summary),
    findings: JSON.parse(row.findings),
    dismissed: JSON.parse(row.dismissed || "[]"),
  };
}

export function dismissAuditFinding(reportId, findingId) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM audit_reports WHERE id = ?").get(reportId);
  if (!row) return null;

  const dismissed = JSON.parse(row.dismissed || "[]");
  if (!dismissed.includes(findingId)) {
    dismissed.push(findingId);
  }
  db.prepare("UPDATE audit_reports SET dismissed = ? WHERE id = ?").run(JSON.stringify(dismissed), reportId);

  return {
    id: row.id,
    createdAt: row.created_at,
    trigger: row.trigger,
    summary: JSON.parse(row.summary),
    findings: JSON.parse(row.findings),
    dismissed,
  };
}

export function promoteDecisionToArchitecture(decisionId) {
  const db = getDb();
  const decision = db.prepare("SELECT * FROM decisions WHERE id = ?").get(decisionId);
  if (!decision) return { ok: false, error: "Decision not found" };

  const project = JSON.parse(decision.project || '["general"]');
  addEntry("architecture", decision.decision, {
    confidence: "firm",
    source: "brain-audit",
    project,
  });

  // Mark resolved and archive the original decision
  resolveDecision(decision.decision);
  archiveEntry("decisions", decision.decision);

  return { ok: true, promoted: decision.decision };
}

export function mergeDuplicateEntries(keepSection, keepText, archiveSection, archiveText) {
  const db = getDb();

  // Build merged text: keep entry text + separator + archived entry text
  const mergedText = `${keepText.trim()}\n—\n${archiveText.trim()}`;

  // Update the kept entry with merged text
  if (keepSection === "decisions") {
    const updated = updateDecision(keepText, { decision: mergedText }, "brain-audit-merge");
    if (!updated) return { ok: false, error: "Keep entry not found" };
  } else {
    const updated = updateEntry(keepSection, keepText, mergedText, { source: "brain-audit-merge" });
    if (updated === false) return { ok: false, error: "Keep entry not found" };
  }

  // Archive the other entry
  archiveEntry(archiveSection, archiveText);

  broadcastEvent("update", { section: keepSection, ts: new Date().toISOString() });

  return { ok: true, mergedText };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

let lastRunDate = null;

let auditIntervalId = null;

export function startAuditSchedule() {
  console.log("[brain-audit] daily schedule started (2:00 AM)");
  auditIntervalId = setInterval(() => {
    const d = new Date();
    const hour = d.getHours();
    const dateStr = d.toISOString().slice(0, 10);

    if (hour === 2 && lastRunDate !== dateStr) {
      lastRunDate = dateStr;
      console.log(`[brain-audit] scheduled audit triggered on ${dateStr}`);
      runBrainAudit("scheduled");
    }
  }, 60_000);
}

export function stopAuditSchedule() {
  if (auditIntervalId) {
    clearInterval(auditIntervalId);
    auditIntervalId = null;
  }
}
