// entry-utils.js — entry normalization and project filtering utilities

// Normalize project field to always be an array
export const normalizeProject = (project) => {
  if (!project) return ["general"];
  if (Array.isArray(project)) return project.length > 0 ? project : ["general"];
  return [project];
};

// Normalize entries: plain strings become objects with metadata
export const toEntry = (val, section, sessionId, source, confidence, project) => {
  const now = new Date().toISOString();
  const conf = confidence || "tentative";
  const proj = normalizeProject(project);
  if (section === "decisions") {
    const base = typeof val === "string" ? { decision: val, status: "open" } : val;
    const entryProj = base.project ? normalizeProject(base.project) : proj;
    return { ...base, confidence: base.confidence || conf, sessionId: base.sessionId || sessionId || null, source: base.source || source || "unknown", project: entryProj, createdAt: base.createdAt || now, lastTouched: now };
  }
  if (typeof val === "string") {
    return { text: val, confidence: conf, sessionId: sessionId || null, source: source || "unknown", project: proj, createdAt: now, lastTouched: now };
  }
  const valProj = val.project ? normalizeProject(val.project) : proj;
  return { ...val, confidence: val.confidence || conf, sessionId: val.sessionId || sessionId || null, source: val.source || source || "unknown", project: valProj, createdAt: val.createdAt || now, lastTouched: now };
};

// Get display text from an entry (handles both old plain-string and new object format)
export const entryText = (entry) => typeof entry === "string" ? entry : (entry.text || entry.decision || "");

// Helper: get project array from an entry (handles string, array, undefined)
export const getEntryProjects = (entry) => {
  if (typeof entry !== "object" || entry === null) return ["general"];
  const p = entry.project;
  if (!p) return ["general"];
  if (Array.isArray(p)) return p;
  return [p];
};

// Helper: filter brain entries by project
export const filterByProject = (brain, projectId) => {
  if (!projectId) return brain;
  const filtered = { ...brain };
  for (const section of ["workingStyle", "architecture", "agentRules"]) {
    filtered[section] = (brain[section] || []).filter(e => {
      return getEntryProjects(e).includes(projectId);
    });
  }
  filtered.decisions = (brain.decisions || []).filter(d => {
    return getEntryProjects(d).includes(projectId);
  });
  return filtered;
};
