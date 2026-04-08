import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

type TabId = 'neural' | 'metrics' | 'missions' | 'sessions' | 'reminders' | 'experiments' | 'observer'

interface TabHelpContent {
  purpose: string
  claudeUses: string
  howToRead: string
}

const HELP_CONTENT: Record<TabId, TabHelpContent> = {
  neural: {
    purpose: 'Visual map of all brain entries — architecture decisions, working style preferences, and agent rules organized by section and project.',
    claudeUses: 'Queries /memory/context at session start to load relevant entries. Writes new entries via POST /memory when decisions are made. Searches with /memory/search before tasks to avoid contradictions.',
    howToRead: 'Entries are grouped by section. Firm entries (solid border) are confirmed decisions. Tentative entries (dashed) are provisional. Click any entry to see history, annotations, and project tags.',
  },
  metrics: {
    purpose: 'Health dashboard showing brain size, entry distribution, staleness, and activity trends over time.',
    claudeUses: 'The /memory/metrics endpoint powers this view. Claude does not directly use metrics, but the orchestration audit checks whether the agent followed best practices.',
    howToRead: 'Green indicators are healthy. Amber means attention needed (e.g., many tentative entries). Red flags stale or unbalanced sections. The activity timeline shows write frequency.',
  },
  missions: {
    purpose: 'Multi-step work tracker. Missions group related tasks that persist across sessions. Includes file locks, agent results, and task dependency graphs.',
    claudeUses: 'Creates missions via POST /missions for non-trivial work. Updates task status as agents complete work. Reads /missions/resume at session start to continue unfinished work. /missions/:id/next returns tasks with resolved dependencies.',
    howToRead: 'Active missions show task progress bars. Each task has a status (pending/in-progress/completed/blocked). Agent names show who worked on what. The metrics panel shows success rate and parallelism.',
  },
  sessions: {
    purpose: 'Session lifecycle tracker. Each Claude Code session is recorded with a label, project, start/end time, and structured handoff summary.',
    claudeUses: 'Registers via POST /sessions/start at startup. Ends with POST /sessions/:id/end including a handoff object. Next session reads /sessions/latest/handoff to resume context. The orchestration scorecard rates each session.',
    howToRead: 'Recent sessions appear at top. Expand a session to see its handoff (what was done, remaining, blocked, decisions). The scorecard badge shows orchestration compliance. Filter sidebar entries by clicking a session.',
  },
  reminders: {
    purpose: 'Personal to-do list. Reminders are created when users say "remind me to..." and persist until completed or snoozed.',
    claudeUses: 'Creates reminders via POST /reminders. Surfaces pending reminders at session start from /memory/context output. Completes them when the user confirms a task is done.',
    howToRead: 'Filter by status (pending/done/snoozed). High-priority reminders have a red indicator. Overdue reminders show how long past due. Click to edit, complete, or snooze.',
  },
  experiments: {
    purpose: 'Process experiment tracker. Tests whether practices (TDD, specific tooling, pair programming style) actually improve agent-assisted work.',
    claudeUses: 'Creates experiments when users say "let\'s try X." Records observations after relevant tasks. Auto-generates observations from mission metrics on mission completion. The effectiveness endpoint analyzes sentiment trends.',
    howToRead: 'Active experiments collect observations with positive/negative/neutral sentiment. The effectiveness panel shows trend direction and suggests concluding when signal is clear (10+ observations, 80%+ one sentiment).',
  },
  observer: {
    purpose: 'Real-time observer dashboard. Monitors live agent sessions via JSONL file tailing, tracks violations, and shows agent execution metrics.',
    claudeUses: 'The observer watches agent JSONL log files (source of truth). Directory watcher auto-registers new agents. SubagentStart/Stop hooks enrich watcher entries with real agent types. Violations are passive (calibrating) — collecting data before promoting to active enforcement.',
    howToRead: 'Live watchers show currently observed agents with event counts and metrics. Violations list shows detected issues (all warnings in passive mode). Agent metrics aggregate tool calls, duration, and tokens across sessions.',
  },
}

export function TabHelp() {
  const activeTab = useUIStore((s) => s.activeTab) as TabId
  const helpExpanded = useUIStore((s) => s.helpExpanded)
  const setHelpExpanded = useUIStore((s) => s.setHelpExpanded)

  const content = HELP_CONTENT[activeTab]
  if (!content) return null

  return (
    <div className="shrink-0 border-b border-brain-surface">
      <button
        className="flex w-full items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setHelpExpanded(!helpExpanded)}
      >
        <HelpCircle className="h-3 w-3" />
        <span>Guide</span>
        {helpExpanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {helpExpanded && (
        <div className="px-4 pb-3 space-y-2 text-xs">
          <div>
            <p className={cn('font-medium text-foreground mb-0.5')}>What is this?</p>
            <p className="text-muted-foreground leading-relaxed">{content.purpose}</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-0.5">How does Claude use this?</p>
            <p className="text-muted-foreground leading-relaxed">{content.claudeUses}</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-0.5">How to read this</p>
            <p className="text-muted-foreground leading-relaxed">{content.howToRead}</p>
          </div>
        </div>
      )}
    </div>
  )
}
