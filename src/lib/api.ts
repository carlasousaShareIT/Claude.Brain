import type {
  Brain,
  SearchResult,
  MetricsData,
  TimelineEntry,
  ConflictResult,
  LogEntry,
  ArchivedEntry,
  Webhook,
  Project,
  Mission,
  MissionSummary,
  ResumableMission,
  SectionName,
  SessionSummary,
  SessionLifecycle,
  SessionHealthOverview,
  SessionHealthDetail,
  HealthReport,
  AgentSummary,
  ContextProfile,
  Reminder,
  Experiment,
  ExperimentSummary,
  Observation,
  AuditReport,
  ObserverViolation,
  ViolationStats,
  ObserverConfig,
  AgentMetricsSummary,
  ObserverWatcher,
} from '@/lib/types';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (options?.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body:
      options?.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options?.body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] !== undefined && pair[1] !== '',
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries).toString();
}

export const api = {
  // Brain
  getBrain: (project?: string) =>
    apiFetch<Brain>(`/memory${qs({ project })}`),

  postMemory: (body: {
    section: SectionName;
    action: string;
    value: string | object;
    source?: string;
    sessionId?: string;
    confidence?: string;
    project?: string[];
  }) => apiFetch<{ ok: boolean }>('/memory', { method: 'POST', body: body as unknown as BodyInit }),

  mergeBrain: (body: { brain: Partial<Brain>; source?: string; sessionId?: string }) =>
    apiFetch<{ ok: boolean }>('/memory/merge', { method: 'POST', body: body as unknown as BodyInit }),

  search: (q: string, project?: string) =>
    apiFetch<{ query: string; count: number; results: SearchResult[] }>(
      `/memory/search${qs({ q, project })}`,
    ),

  getSessions: () => apiFetch<SessionSummary[]>('/memory/sessions'),

  getSessionLifecycle: (id: string) =>
    apiFetch<SessionLifecycle>(`/sessions/${id}`),

  listSessionLifecycles: (params?: { limit?: number; project?: string }) =>
    apiFetch<SessionLifecycle[]>(`/sessions${qs({ limit: params?.limit?.toString(), project: params?.project })}`),

  getSessionsHealth: (limit?: number) =>
    apiFetch<SessionHealthOverview>(`/sessions/health${qs({ limit: limit?.toString() })}`),

  getSessionHealth: (id: string) =>
    apiFetch<SessionHealthDetail>(`/sessions/${id}/health`),

  getLog: () => apiFetch<LogEntry[]>('/memory/log'),

  clearLog: () => apiFetch<{ ok: boolean }>('/memory/log', { method: 'DELETE' }),

  autoAdd: (body: {
    value: string | object;
    source?: string;
    sessionId?: string;
    project?: string[];
  }) => apiFetch<{ ok: boolean }>('/memory/auto', { method: 'POST', body: body as unknown as BodyInit }),

  setConfidence: (body: { section: SectionName; text: string; confidence: 'firm' | 'tentative' }) =>
    apiFetch<{ ok: boolean }>('/memory/confidence', { method: 'POST', body: body as unknown as BodyInit }),

  getContext: (params?: { project?: string; mission?: string }) =>
    apiFetch<string>(`/memory/context${qs({ project: params?.project, mission: params?.mission })}`, {
      headers: { Accept: 'text/markdown' },
    }),

  getTimeline: (project?: string) =>
    apiFetch<TimelineEntry[]>(`/memory/timeline${qs({ project })}`),

  checkConflicts: (body: { value: string; section?: SectionName }) =>
    apiFetch<{ conflicts: ConflictResult[] }>('/memory/check', { method: 'POST', body: body as unknown as BodyInit }),

  diff: (body: { entries: Array<{ section: string; text: string }>; project?: string }) =>
    apiFetch<{ missing: Array<{ section: string; text: string }> }>('/memory/diff', {
      method: 'POST',
      body: body as unknown as BodyInit,
    }),

  retag: (body: { section: SectionName; text: string; project: string[] }) =>
    apiFetch<{ ok: boolean }>('/memory/retag', { method: 'POST', body: body as unknown as BodyInit }),

  // Archive
  archive: (body: { section: SectionName; text: string }) =>
    apiFetch<{ ok: boolean }>('/memory/archive', { method: 'POST', body: body as unknown as BodyInit }),

  getArchived: () => apiFetch<ArchivedEntry[]>('/memory/archived'),

  unarchive: (body: { text: string }) =>
    apiFetch<{ ok: boolean }>('/memory/unarchive', { method: 'POST', body: body as unknown as BodyInit }),

  // Metrics
  getMetrics: (project?: string) =>
    apiFetch<MetricsData>(`/memory/metrics${qs({ project })}`),

  // Webhooks
  addWebhook: (body: { url: string; events: string[] }) =>
    apiFetch<{ ok: boolean }>('/memory/webhooks', { method: 'POST', body: body as unknown as BodyInit }),

  removeWebhook: (body: { url: string }) =>
    apiFetch<{ ok: boolean }>('/memory/webhooks', { method: 'DELETE', body: body as unknown as BodyInit }),

  getWebhooks: () => apiFetch<Webhook[]>('/memory/webhooks'),

  // Projects
  getProjects: () => apiFetch<Project[]>('/memory/projects'),

  addProject: (body: { id: string; name: string; repos?: string[] }) =>
    apiFetch<{ ok: boolean }>('/memory/projects', { method: 'POST', body: body as unknown as BodyInit }),

  removeProject: (body: { id: string }) =>
    apiFetch<{ ok: boolean }>('/memory/projects', { method: 'DELETE', body: body as unknown as BodyInit }),

  closeProject: (body: { id: string }) =>
    apiFetch<{ ok: boolean }>('/memory/projects/close', { method: 'POST', body: body as unknown as BodyInit }),

  reopenProject: (body: { id: string }) =>
    apiFetch<{ ok: boolean }>('/memory/projects/reopen', { method: 'POST', body: body as unknown as BodyInit }),

  // Missions
  getMissions: (params?: { status?: string; project?: string }) =>
    apiFetch<MissionSummary[]>(`/missions${qs({ status: params?.status, project: params?.project })}`),

  getResumable: (project?: string) =>
    apiFetch<{ missions: ResumableMission[] }>(`/missions/resume${qs({ project })}`),

  getMission: (id: string) => apiFetch<Mission>(`/missions/${id}`),

  createMission: (body: {
    name: string;
    project?: string;
    sessionId?: string;
    tasks?: Array<{ description: string; title?: string }>;
  }) => apiFetch<Mission>('/missions', { method: 'POST', body: body as unknown as BodyInit }),

  updateMission: (id: string, body: { name?: string; status?: string }) =>
    apiFetch<Mission>(`/missions/${id}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  deleteMission: (id: string) =>
    apiFetch<{ ok: boolean }>(`/missions/${id}`, { method: 'DELETE' }),

  addTasks: (missionId: string, body: { tasks: Array<{ description: string; title?: string; blockedBy?: string[] }> }) =>
    apiFetch<Array<{ id: string; description: string; status: string; blockedBy: string[] }>>(`/missions/${missionId}/tasks`, { method: 'POST', body: body as unknown as BodyInit }),

  updateTask: (
    missionId: string,
    taskId: string,
    body: {
      status?: string;
      assignedAgent?: string;
      sessionId?: string;
      output?: string;
      blockers?: string[];
      blockedBy?: string[];
      title?: string;
    },
  ) =>
    apiFetch<Mission>(`/missions/${missionId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: body as unknown as BodyInit,
    }),

  // Health
  checkHealth: (body: { repoPath?: string }) =>
    apiFetch<HealthReport>('/memory/health', { method: 'POST', body: body as unknown as BodyInit }),

  // Agents
  getAgents: () => apiFetch<AgentSummary[]>('/missions/agents'),

  // Profiles
  getProfiles: () => apiFetch<ContextProfile[]>('/memory/profiles'),

  createProfile: (body: { name: string; taskType: string; sections: SectionName[]; tags: string[]; project?: string | null; model?: string; role?: string; systemPrompt?: string; constraints?: string[] }) =>
    apiFetch<ContextProfile>('/memory/profiles', { method: 'POST', body: body as unknown as BodyInit }),

  updateProfile: (id: string, body: Partial<{ name: string; taskType: string; sections: SectionName[]; tags: string[]; project: string | null; model: string; role: string; systemPrompt: string; constraints: string[] }>) =>
    apiFetch<ContextProfile>(`/memory/profiles/${id}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  deleteProfile: (id: string) =>
    apiFetch<{ ok: boolean }>(`/memory/profiles/${id}`, { method: 'DELETE' }),

  // Reminders
  getReminders: (params?: { status?: string; project?: string }) =>
    apiFetch<Reminder[]>(`/reminders${qs({ status: params?.status, project: params?.project })}`),

  createReminder: (body: { text: string; dueDate?: string; priority?: string; project?: string[] }) =>
    apiFetch<Reminder>('/reminders', { method: 'POST', body: body as unknown as BodyInit }),

  updateReminder: (id: string, body: { text?: string; status?: string; priority?: string; dueDate?: string | null; snoozedUntil?: string; project?: string[] }) =>
    apiFetch<Reminder>(`/reminders/${id}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  deleteReminder: (id: string) =>
    apiFetch<{ ok: boolean }>(`/reminders/${id}`, { method: 'DELETE' }),

  // Experiments
  getExperiments: (params?: { status?: string; project?: string }) =>
    apiFetch<ExperimentSummary[]>(`/experiments${qs({ status: params?.status, project: params?.project })}`),

  getExperiment: (id: string) => apiFetch<Experiment>(`/experiments/${id}`),

  createExperiment: (body: { name: string; hypothesis: string; project?: string[]; sessionId?: string }) =>
    apiFetch<Experiment>('/experiments', { method: 'POST', body: body as unknown as BodyInit }),

  updateExperiment: (id: string, body: { name?: string; hypothesis?: string; status?: string; conclusion?: string; project?: string[] }) =>
    apiFetch<Experiment>(`/experiments/${id}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  addObservation: (experimentId: string, body: { text: string; sentiment?: string; sessionId?: string; source?: string }) =>
    apiFetch<Observation>(`/experiments/${experimentId}/observations`, { method: 'POST', body: body as unknown as BodyInit }),

  updateObservation: (experimentId: string, obsId: string, body: { text?: string; sentiment?: string }) =>
    apiFetch<Observation>(`/experiments/${experimentId}/observations/${obsId}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  deleteObservation: (experimentId: string, obsId: string) =>
    apiFetch<{ ok: boolean }>(`/experiments/${experimentId}/observations/${obsId}`, { method: 'DELETE' }),

  deleteExperiment: (id: string) =>
    apiFetch<{ ok: boolean }>(`/experiments/${id}`, { method: 'DELETE' }),

  getExperimentEffectiveness: (id: string) =>
    apiFetch<{
      experimentId: string
      name: string
      hypothesis: string
      status: string
      observationCount: number
      sentimentBreakdown: { positive: number; negative: number; neutral: number }
      positiveRate: number
      avgSuccessRate: number | null
      avgReworkRate: number | null
      trend: string
      suggestConclude: boolean
      suggestedConclusion: string | null
    }>(`/experiments/${id}/effectiveness`),

  // Mission metrics
  getMissionMetrics: (id: string) =>
    apiFetch<{
      missionId: string
      taskCount: number
      completedCount: number
      blockedCount: number
      pendingCount: number
      inProgressCount: number
      successRate: number
      avgDurationMs: number
      reworkRate: number
      agentCount: number
      parallelismFactor: number
    }>(`/missions/${id}/metrics`),

  // Audit
  getAuditReports: (limit?: number) =>
    apiFetch<AuditReport[]>(`/audit/reports${qs({ limit: limit?.toString() })}`),

  getLatestAudit: () =>
    apiFetch<AuditReport>('/audit/reports/latest'),

  runAudit: () =>
    apiFetch<AuditReport>('/audit/run', { method: 'POST' }),

  dismissFinding: (body: { reportId: number; findingId: string }) =>
    apiFetch<AuditReport>('/audit/dismiss', { method: 'POST', body: body as unknown as BodyInit }),

  promoteDecision: (body: { decisionId: number }) =>
    apiFetch<{ ok: boolean; promoted: string }>('/audit/promote', { method: 'POST', body: body as unknown as BodyInit }),

  mergeEntries: (body: { keepSection: string; keepText: string; archiveSection: string; archiveText: string }) =>
    apiFetch<{ ok: boolean; mergedText: string }>('/audit/merge', { method: 'POST', body: body as unknown as BodyInit }),

  // Observer violations
  getViolations: (params?: { agent?: string; type?: string; session?: string }) =>
    apiFetch<ObserverViolation[]>(`/observer/violations${qs({ agent: params?.agent, type: params?.type, session: params?.session })}`),

  getViolationStats: () =>
    apiFetch<ViolationStats>('/observer/violations/stats'),

  getObserverConfig: () =>
    apiFetch<ObserverConfig>('/observer/config'),

  getWatchers: () =>
    apiFetch<ObserverWatcher[]>('/observer/watchers'),

  patchObserverConfig: (config: Partial<ObserverConfig>) =>
    apiFetch<ObserverConfig>('/observer/config', { method: 'PATCH', body: config as unknown as BodyInit }),

  // Agent metrics
  getAgentMetricsSummary: (params?: { agent?: string }) =>
    apiFetch<AgentMetricsSummary[]>(`/observer/metrics/summary${qs({ agent: params?.agent })}`),

  // Mission task retry
  retryTask: (missionId: string, taskId: string) =>
    apiFetch<Mission>(`/missions/${missionId}/tasks/${taskId}/retry`, { method: 'PATCH' }),
};

export { ApiError };
