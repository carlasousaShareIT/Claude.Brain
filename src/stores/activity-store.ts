import { create } from 'zustand'

export interface ActivityEvent {
  id: string
  missionId: string
  missionName: string
  taskId: string
  taskDescription: string
  agent: string | null
  status: string
  timestamp: string
}

const MAX_EVENTS = 50

function deriveActiveAgents(events: ActivityEvent[]): ActivityEvent[] {
  const latest = new Map<string, ActivityEvent>()
  for (const e of events) {
    if (!e.agent) continue
    if (!latest.has(e.agent)) latest.set(e.agent, e)
  }
  return [...latest.values()].filter((e) => e.status === 'in_progress')
}

interface ActivityState {
  events: ActivityEvent[]
  activeAgents: ActivityEvent[]
  addEvent: (event: ActivityEvent) => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  activeAgents: [],
  addEvent: (event) =>
    set((state) => {
      const events = [event, ...state.events].slice(0, MAX_EVENTS)
      return { events, activeAgents: deriveActiveAgents(events) }
    }),
}))
