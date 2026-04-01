// merge-utils.js — brain merge logic

import { entryText } from "./entry-utils.js";

const DEFAULT_PROJECTS = [
  { id: "general", name: "General", repos: [], status: "active" },
];

// Merge two brain objects — union of all arrays, deduplicated
export const mergeBrains = (a, b) => {
  const merged = { workingStyle: [], architecture: [], agentRules: [], decisions: [], log: [], archived: [...(a.archived || []), ...(b.archived || [])], webhooks: [...(a.webhooks || [])], projects: [...(a.projects || DEFAULT_PROJECTS)], experiments: [] };

  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    const combined = [...(a[section] || []), ...(b[section] || [])];
    const seen = new Set();
    merged[section] = combined.filter(e => {
      const t = entryText(e);
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }

  const decisionMap = new Map();
  for (const d of [...(a.decisions || []), ...(b.decisions || [])]) {
    const key = d.decision || d;
    const existing = decisionMap.get(key);
    if (!existing || d.status === "resolved") decisionMap.set(key, d);
  }
  merged.decisions = [...decisionMap.values()];

  const allLogs = [...(a.log || []), ...(b.log || [])];
  const seen = new Set();
  merged.log = allLogs
    .filter(l => { const k = `${l.ts}-${l.value}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => new Date(y.ts) - new Date(x.ts))
    .slice(0, 500);

  // Merge missions — dedupe by ID, prefer the one with more completed tasks
  const missionMap = new Map();
  for (const m of [...(a.missions || []), ...(b.missions || [])]) {
    const existing = missionMap.get(m.id);
    if (!existing) {
      missionMap.set(m.id, m);
    } else {
      const countCompleted = (mission) => (mission.tasks || []).filter(t => t.status === "completed").length;
      if (countCompleted(m) > countCompleted(existing)) missionMap.set(m.id, m);
    }
  }
  merged.missions = [...missionMap.values()];

  // Merge experiments — dedupe by ID, prefer the one with more observations
  const experimentMap = new Map();
  for (const e of [...(a.experiments || []), ...(b.experiments || [])]) {
    const existing = experimentMap.get(e.id);
    if (!existing) {
      experimentMap.set(e.id, e);
    } else {
      if ((e.observations || []).length > (existing.observations || []).length) experimentMap.set(e.id, e);
    }
  }
  merged.experiments = [...experimentMap.values()];

  return merged;
};
