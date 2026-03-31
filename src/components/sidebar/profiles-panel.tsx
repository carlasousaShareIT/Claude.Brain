import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, X } from 'lucide-react'
import { useProfiles } from '@/hooks/use-profiles'
import { SECTION_COLORS, SECTION_LABELS, SECTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import type { ContextProfile, SectionName } from '@/lib/types'

interface ProfileDialogProps {
  profile: ContextProfile
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => void
}

function ProfileDialog({ profile, open, onOpenChange, onDelete }: ProfileDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      `curl -s "http://localhost:7777/memory/context?profile=${profile.id}"`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <DialogTitle>{profile.name}</DialogTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {profile.taskType && (
                <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a]">
                  {profile.taskType}
                </span>
              )}
              {profile.model && (
                <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a]">
                  {profile.model}
                </span>
              )}
            </div>
          </div>
          <DialogClose className="rounded p-1 text-[#62627a] hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </DialogClose>
        </div>

        <div className="mt-4 space-y-3">
          {profile.role && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">Role</p>
              <p className="text-xs text-foreground/80">{profile.role}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">Sections</p>
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
          </div>

          {profile.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">Tags</p>
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
            </div>
          )}

          {profile.project && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">Project</p>
              <p className="text-xs text-foreground/70">{profile.project}</p>
            </div>
          )}

          {profile.systemPrompt && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">System prompt</p>
              <div className="whitespace-pre-wrap rounded bg-brain-surface px-3 py-2 text-xs text-foreground/80 leading-relaxed">
                {profile.systemPrompt}
              </div>
            </div>
          )}

          {profile.constraints && profile.constraints.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a] mb-1">Constraints</p>
              <ul className="space-y-1">
                {profile.constraints.map((c, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-foreground/80">
                    <span className="shrink-0 text-[#62627a]">-</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-brain-surface pt-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded bg-brain-surface px-2 py-1 text-[10px] text-[#62627a] hover:text-foreground transition-colors"
          >
            <Copy className="h-2.5 w-2.5" />
            {copied ? 'Copied!' : 'Copy curl'}
          </button>
          <button
            onClick={() => { onDelete(profile.id); onOpenChange(false) }}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-brain-red hover:opacity-80 transition-opacity"
          >
            <Trash2 className="h-2.5 w-2.5" />
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProfileRow({ profile, onSelect }: { profile: ContextProfile; onSelect: (p: ContextProfile) => void }) {
  return (
    <button
      onClick={() => onSelect(profile)}
      className="flex w-full items-center gap-1.5 rounded-md bg-brain-base px-2 py-1.5 text-left hover:bg-brain-surface/50 transition-colors"
    >
      <span className="flex-1 truncate text-xs text-foreground">{profile.name}</span>
      <div className="flex shrink-0 items-center gap-1">
        {profile.taskType && (
          <span className="rounded bg-brain-surface px-1 py-0.5 text-[10px] text-[#62627a]">
            {profile.taskType}
          </span>
        )}
        {profile.model && (
          <span className="rounded bg-brain-surface px-1 py-0.5 text-[10px] text-[#62627a]">
            {profile.model}
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
  )
}

const DEFAULT_SECTIONS: SectionName[] = ['workingStyle', 'architecture', 'agentRules', 'decisions']

export function ProfilesPanel() {
  const { data: profiles, createProfile, deleteProfile } = useProfiles()
  const count = profiles?.length ?? 0
  const [expanded, setExpanded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ContextProfile | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [taskType, setTaskType] = useState('')
  const [selectedSections, setSelectedSections] = useState<SectionName[]>(DEFAULT_SECTIONS)
  const [tags, setTags] = useState('')
  const [model, setModel] = useState<string>('')
  const [role, setRole] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
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
    const constraintsList = constraintsText.split(',').map(c => c.trim()).filter(Boolean)
    await createProfile.mutateAsync({
      name: name.trim(),
      taskType: taskType.trim(),
      sections: selectedSections,
      tags: tagList,
      model: model || undefined,
      role: role.trim() || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      constraints: constraintsList.length ? constraintsList : undefined,
      project: project.trim() || null,
    })
    setName('')
    setTaskType('')
    setSelectedSections(DEFAULT_SECTIONS)
    setTags('')
    setModel('')
    setRole('')
    setSystemPrompt('')
    setConstraintsText('')
    setProject('')
    setShowCreate(false)
  }

  const handleDelete = (id: string) => {
    deleteProfile.mutate(id)
  }

  return (
    <>
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
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value="">Model (default)</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                  <option value="haiku">Haiku</option>
                </select>
                <input
                  type="text"
                  placeholder="Role (e.g. implements features, one task at a time)"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
                />
                <textarea
                  placeholder="System prompt (role-specific instructions)"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-brain-surface border border-white/10 rounded px-2 py-1 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none resize-y"
                />
                <input
                  type="text"
                  placeholder="Constraints (comma-separated)"
                  value={constraintsText}
                  onChange={(e) => setConstraintsText(e.target.value)}
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
              <ProfileRow key={profile.id} profile={profile} onSelect={setSelectedProfile} />
            ))}

            {!showCreate && count === 0 && (
              <p className="py-2 text-center text-[10px] text-[#62627a]">No profiles yet.</p>
            )}
          </div>
        )}
      </div>

      {selectedProfile && (
        <ProfileDialog
          profile={selectedProfile}
          open={true}
          onOpenChange={(open) => { if (!open) setSelectedProfile(null) }}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
