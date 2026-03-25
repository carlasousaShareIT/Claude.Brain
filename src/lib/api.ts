import type {
  Brain,
  SearchResult,
  MetricsData,
  TimelineEntry,
  ConflictResult,
  LogEntry,
  ArchivedEntry,
  Annotation,
  Webhook,
  Project,
  Mission,
  MissionSummary,
  ResumableMission,
  SectionName,
} from '@/lib/types';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
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

  getSessions: () => apiFetch<string[]>('/memory/sessions'),

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

  // Annotations
  annotate: (body: {
    section: SectionName;
    text: string;
    note: string;
    source?: string;
    sessionId?: string;
  }) => apiFetch<{ ok: boolean }>('/memory/annotate', { method: 'POST', body: body as unknown as BodyInit }),

  removeAnnotation: (body: { section: SectionName; text: string; note: string }) =>
    apiFetch<{ ok: boolean }>('/memory/annotate', { method: 'DELETE', body: body as unknown as BodyInit }),

  getAnnotations: () =>
    apiFetch<Array<{ section: string; text: string; annotations: Annotation[] }>>('/memory/annotations'),

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
    tasks?: Array<{ description: string }>;
  }) => apiFetch<Mission>('/missions', { method: 'POST', body: body as unknown as BodyInit }),

  updateMission: (id: string, body: { name?: string; status?: string }) =>
    apiFetch<Mission>(`/missions/${id}`, { method: 'PATCH', body: body as unknown as BodyInit }),

  deleteMission: (id: string) =>
    apiFetch<{ ok: boolean }>(`/missions/${id}`, { method: 'DELETE' }),

  addTasks: (missionId: string, body: { tasks: Array<{ description: string }> }) =>
    apiFetch<Mission>(`/missions/${missionId}/tasks`, { method: 'POST', body: body as unknown as BodyInit }),

  updateTask: (
    missionId: string,
    taskId: string,
    body: {
      status?: string;
      assignedAgent?: string;
      sessionId?: string;
      output?: string;
      blockers?: string[];
    },
  ) =>
    apiFetch<Mission>(`/missions/${missionId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: body as unknown as BodyInit,
    }),
};

export { ApiError };
