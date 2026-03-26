export type SectionName = 'workingStyle' | 'architecture' | 'agentRules' | 'decisions';

export interface Annotation {
  note: string;
  ts: string;
  source: string;
  sessionId: string | null;
}

export interface BrainEntry {
  text: string;
  confidence: 'firm' | 'tentative';
  sessionId: string | null;
  source: string;
  project: string[];
  createdAt: string;
  lastTouched: string;
  history?: { text: string; changedAt: string; changedBy: string }[];
  annotations?: Annotation[];
}

export interface Decision {
  decision: string;
  status: 'open' | 'resolved';
  confidence: 'firm' | 'tentative';
  sessionId: string | null;
  source: string;
  project: string[];
  createdAt: string;
  lastTouched: string;
  history?: { text: string; changedAt: string; changedBy: string }[];
  annotations?: Annotation[];
}

export interface ArchivedEntry extends BrainEntry {
  section: string;
  archivedAt: string;
  decision?: string;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignedAgent: string | null;
  sessionId: string | null;
  output: string | null;
  blockers: string[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Mission {
  id: string;
  name: string;
  project: string | null;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
  createdInSession: string | null;
  completedAt: string | null;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  repos: string[];
  status: 'active' | 'closed';
}

export interface LogEntry {
  ts: string;
  source: string;
  sessionId: string | null;
  section: string;
  action: string;
  value: string | object;
}

export interface Webhook {
  url: string;
  events: string[];
}

export interface Brain {
  workingStyle: BrainEntry[];
  architecture: BrainEntry[];
  agentRules: BrainEntry[];
  decisions: Decision[];
  log: LogEntry[];
  archived: ArchivedEntry[];
  webhooks: Webhook[];
  missions: Mission[];
  projects: Project[];
  reminders: Reminder[];
}

export interface SearchResult {
  section: string;
  entry: BrainEntry | Decision;
}

export interface MetricsData {
  totalEntries: number;
  bySection: Record<string, number>;
  byConfidence: { firm: number; tentative: number };
  byStatus: { open: number; resolved: number };
  archived: number;
  avgAgeDays: number;
  oldestEntry: { text: string; section: string; createdAt: string } | null;
  newestEntry: { text: string; section: string; createdAt: string } | null;
  sessionsCount: number;
  annotationsCount: number;
  activityByDay: Record<string, number>;
}

export interface TimelineEntry {
  text: string;
  section: string;
  createdAt: string | null;
  archivedAt: string | null;
  removedAt: string | null;
}

export interface ConflictResult {
  section: string;
  text: string;
  reason: string;
  overlap: string[];
}

export interface MissionSummary {
  id: string;
  name: string;
  project: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  taskCounts: {
    pending: number;
    in_progress: number;
    completed: number;
    blocked: number;
  };
}

export interface ResumableMission {
  id: string;
  name: string;
  project: string | null;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  blockedTasks: number;
  tasks: Task[];
}

export type ChatMessage =
  | { id: string; role: 'user' | 'assistant'; content: string; type: 'text' | 'thinking' }
  | { id: string; role: 'user' | 'assistant'; content: string; type: 'search-results'; data: SearchResult[] }
  | { id: string; role: 'user' | 'assistant'; content: string; type: 'conflict'; data: ConflictResult[] }
  | { id: string; role: 'user' | 'assistant'; content: string; type: 'batch'; data: string[] };

export interface SessionSummary {
  id: string
  label: string | null
  count: number
  sections: Record<string, number>
  projects: string[]
  earliest: string | null
  latest: string | null
}

export interface HealthReference {
  path: string
  exists: boolean
}

export interface HealthEntry {
  section: string
  text: string
  references: HealthReference[]
}

export interface HealthReport {
  checkedEntries: number
  staleEntries: HealthEntry[]
  healthyEntries: HealthEntry[]
  noReferencesEntries: number
}

export interface AgentTaskSummary {
  id: string
  description: string
  status: string
  output: string | null
  missionId: string
  missionName: string
  startedAt: string | null
  completedAt: string | null
}

export interface AgentSummary {
  name: string
  taskCount: number
  completedCount: number
  failedCount: number
  blockedCount: number
  inProgressCount: number
  avgDurationMs: number
  lastUsed: string | null
  recentTasks: AgentTaskSummary[]
}

export interface ContextProfile {
  id: string
  name: string
  taskType: string
  sections: SectionName[]
  tags: string[]
  project: string | null
  createdAt: string
  updatedAt: string
}

export interface Reminder {
  id: string
  text: string
  status: 'pending' | 'done' | 'snoozed'
  priority: 'low' | 'normal' | 'high'
  dueDate: string | null
  project: string[]
  createdAt: string
  completedAt: string | null
  snoozedUntil: string | null
}
