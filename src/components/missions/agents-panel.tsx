import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useAgents } from '@/hooks/use-agents'
import { AgentCard } from './agent-card'

export function AgentsPanel() {
  const { data: agents } = useAgents()
  const count = agents?.length ?? 0
  const [expanded, setExpanded] = useState(count > 0)

  // Expand by default once agents load, but don't force re-collapse after
  // We use a ref pattern to auto-expand on first non-empty load only
  const hasAgents = count > 0

  return (
    <div className="pt-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-1 py-1 hover:text-foreground transition-colors"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 text-[#62627a]" />
          : <ChevronRight className="h-3 w-3 text-[#62627a]" />
        }
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
          Agents
        </span>
        <span className="text-[10px] text-[#62627a]">({count})</span>
      </button>

      {expanded && hasAgents && (
        <div className="mt-1 space-y-2">
          {agents!.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      )}

      {expanded && !hasAgents && (
        <p className="py-4 text-center text-[10px] text-[#62627a]">No agent activity yet.</p>
      )}
    </div>
  )
}
