import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, Copy } from 'lucide-react'
import { useProfiles } from '@/hooks/use-profiles'
import { SECTION_COLORS, SECTION_LABELS, SECTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ContextProfile, SectionName } from '@/lib/types'

interface ProfileRowProps {
  profile: ContextProfile
  onDelete: (id: string) => void
}

function ProfileRow({ profile, onDelete }: ProfileRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      `curl -s "http://localhost:7777/memory/context?profile=${profile.id}"`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-md bg-brain-base px-2 py-1.5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 shrink-0 text-[#62627a]" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-[#62627a]" />
        }
        <span className="flex-1 truncate text-xs text-foreground">{profile.name}</span>
        <div className="flex shrink-0 items-center gap-1">
          {profile.taskType && (
            <span className="rounded bg-brain-surface px-1 py-0.5 text-[10px] text-[#62627a]">
              {profile.taskType}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            {profile.sections.map((s) => (
              <span
                key={s}
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: SECTION_COLORS[s] }}
                title={SECTION_LABELS[s]}
              />
            ))}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4">
          <div className="flex flex-wrap gap-1">
            {profile.sections.map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor: `${SECTION_COLORS[s]}20`,
                  color: SECTION_COLORS[s],
                }}
              >
                {SECTION_LABELS[s]}
              </span>
            ))}
          </div>

          {profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {profile.project && (
            <p className="text-[10px] text-[#62627a]">
              project: <span className="text-foreground/70">{profile.project}</span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded bg-brain-surface px-2 py-1 text-[10px] text-[#62627a] hover:text-foreground transition-colors"
            >
              <Copy className="h-2.5 w-2.5" />
              {copied ? 'Copied!' : 'Copy curl'}
            </button>
            <button
              onClick={() => onDelete(profile.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-brain-red hover:opacity-80 transition-opacity"
            >
              <Trash2 className="h-2.5 w-2.5" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const DEFAULT_SECTIONS: SectionName[] = ['workingStyle', 'architecture', 'agentRules', 'decisions']

export function ProfilesPanel() {
  const { data: profiles, createProfile, deleteProfile } = useProfiles()
  const count = profiles?.length ?? 0
  const [expanded, setExpanded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [name, setName] = useState('')
  const [taskType, setTaskType] = useState('')
  const [selectedSections, setSelectedSections] = useState<SectionName[]>(DEFAULT_SECTIONS)
  const [tags, setTags] = useState('')
  const [project, setProject] = useState('')

  const toggleSection = (s: SectionName) => {
    setSelectedSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await createProfile.mutateAsync({
      name: name.trim(),
      taskType: taskType.trim(),
      sections: selectedSections,
      tags: tagList,
      project: project.trim() || null,
    })
    setName('')
    setTaskType('')
    setSelectedSections(DEFAULT_SECTIONS)
    setTags('')
    setProject('')
    setShowCreate(false)
  }

  const handleDelete = (id: string) => {
    deleteProfile.mutate(id)
  }

  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-1.5 py-1 hover:text-foreground transition-colors"
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 text-[#62627a]" />
            : <ChevronRight className="h-3 w-3 text-[#62627a]" />
          }
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
            Profiles
          </span>
          <span className="text-[10px] text-[#62627a]">({count})</span>
        </button>
        <button
          onClick={() => { setShowCreate((s) => !s); setExpanded(true) }}
          className="rounded p-0.5 text-[#62627a] hover:text-foreground transition-colors"
          aria-label="New profile"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {showCreate && (
            <div className="rounded-md bg-brain-base p-2 space-y-2">
              <input
                type="text"
                placeholder="Profile name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Task type (e.g. pr-review)"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {SECTIONS.map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(s)}
                      onChange={() => toggleSection(s)}
                      className="h-3 w-3 accent-brain-surface"
                    />
                    <span className="text-[10px] text-[#62627a]">{SECTION_LABELS[s]}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Project (optional)"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || createProfile.isPending}
                  className={cn(
                    'rounded bg-brain-surface px-2 py-1 text-[10px] text-foreground transition-opacity',
                    (!name.trim() || createProfile.isPending) && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded px-2 py-1 text-[10px] text-[#62627a] hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(profiles ?? []).map((profile) => (
            <ProfileRow key={profile.id} profile={profile} onDelete={handleDelete} />
          ))}

          {!showCreate && count === 0 && (
            <p className="py-2 text-center text-[10px] text-[#62627a]">No profiles yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
