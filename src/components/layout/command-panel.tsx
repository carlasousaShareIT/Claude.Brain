import { useState, useCallback } from 'react';
import type { ChatMessage, SearchResult, SectionName } from '@/lib/types';
import { useBrain } from '@/hooks/use-brain';
import { useArchived } from '@/hooks/use-archived';
import { useMissions } from '@/hooks/use-missions';
import { useUIStore } from '@/stores/ui-store';
import { parseCommand } from '@/hooks/use-command-parser';
import type { ParsedCommand } from '@/hooks/use-command-parser';
import { entryText } from '@/lib/utils';
import { api } from '@/lib/api';
import { Separator } from '@/components/ui/separator';
import { CommandHeader } from '@/components/command/command-header';
import { ChatMessages } from '@/components/command/chat-messages';
import { QuickActions } from '@/components/command/quick-actions';
import { CommandInput } from '@/components/command/command-input';

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function userMsg(content: string): ChatMessage {
  return { id: nextId(), role: 'user', content, type: 'text' };
}

function assistantMsg(content: string, type: ChatMessage['type'] = 'text', data?: unknown): ChatMessage {
  return { id: nextId(), role: 'assistant', content, type, data };
}

export function CommandPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingConflictAdd, setPendingConflictAdd] = useState<(() => Promise<void>) | null>(null);

  const activeProject = useUIStore((s) => s.activeProject);
  const brain = useBrain(activeProject || undefined);
  const archived = useArchived();
  const missions = useMissions(undefined, activeProject || undefined);

  const addMessages = useCallback((...msgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
  }, []);

  const removeThinking = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.type !== 'thinking'));
  }, []);

  const executeCommand = useCallback(
    async (cmd: ParsedCommand, rawInput: string) => {
      switch (cmd.type) {
        case 'search': {
          if (!cmd.text) return;
          const thinking = assistantMsg('', 'thinking');
          addMessages(thinking);
          try {
            const result = await brain.search.mutateAsync({
              q: cmd.text,
              project: activeProject || undefined,
            });
            removeThinking();
            if (result.results.length === 0) {
              addMessages(assistantMsg(`No results for "${cmd.text}".`));
            } else {
              addMessages(
                assistantMsg(
                  `${result.count} result${result.count !== 1 ? 's' : ''} for "${cmd.text}".`,
                  'search-results',
                  result.results
                )
              );
            }
          } catch {
            removeThinking();
            addMessages(assistantMsg('Search failed. Is the brain server running?'));
          }
          break;
        }

        case 'add': {
          if (!cmd.text) return;
          const thinking = assistantMsg('', 'thinking');
          addMessages(thinking);
          try {
            if (cmd.natural) {
              await brain.autoAdd.mutateAsync({
                value: cmd.text,
                source: 'brain-app',
                project: activeProject ? [activeProject] : [],
              });
              removeThinking();
              addMessages(assistantMsg(`Added (auto-detected section): "${cmd.text}".`));
            } else if (cmd.section) {
              // Check for conflicts first
              const conflictCheck = await brain.checkConflicts.mutateAsync({
                value: cmd.text,
                section: cmd.section,
              });
              if (conflictCheck.conflicts.length > 0) {
                removeThinking();
                const doAdd = async () => {
                  await brain.postMemory.mutateAsync({
                    section: cmd.section!,
                    action: cmd.section === 'decisions' ? 'add' : 'add',
                    value: cmd.section === 'decisions' ? { decision: cmd.text!, status: 'open' } : cmd.text!,
                    source: 'brain-app',
                    project: activeProject ? [activeProject] : [],
                  });
                  addMessages(assistantMsg(`Added to ${cmd.section}: "${cmd.text}".`));
                };
                setPendingConflictAdd(() => doAdd);
                addMessages(assistantMsg('', 'conflict', conflictCheck.conflicts));
                return;
              }
              await brain.postMemory.mutateAsync({
                section: cmd.section,
                action: cmd.section === 'decisions' ? 'add' : 'add',
                value: cmd.section === 'decisions' ? { decision: cmd.text, status: 'open' } : cmd.text,
                source: 'brain-app',
                project: activeProject ? [activeProject] : [],
              });
              removeThinking();
              addMessages(assistantMsg(`Added to ${cmd.section}: "${cmd.text}".`));
            }
          } catch {
            removeThinking();
            addMessages(assistantMsg('Failed to add entry.'));
          }
          break;
        }

        case 'archive': {
          if (!cmd.section || !cmd.text) return;
          try {
            await archived.archive.mutateAsync({ section: cmd.section, text: cmd.text });
            addMessages(assistantMsg(`Archived from ${cmd.section}: "${cmd.text}".`));
          } catch {
            addMessages(assistantMsg('Failed to archive entry.'));
          }
          break;
        }

        case 'unarchive': {
          if (!cmd.text) return;
          try {
            await archived.unarchive.mutateAsync({ text: cmd.text });
            addMessages(assistantMsg(`Unarchived: "${cmd.text}".`));
          } catch {
            addMessages(assistantMsg('Failed to unarchive entry.'));
          }
          break;
        }

        case 'showArchived': {
          const thinking = assistantMsg('', 'thinking');
          addMessages(thinking);
          try {
            const data = await archived.refetch();
            removeThinking();
            const items = data.data ?? [];
            if (items.length === 0) {
              addMessages(assistantMsg('No archived entries.'));
            } else {
              const results: SearchResult[] = items.map((a) => ({
                section: a.section,
                entry: a,
              }));
              addMessages(
                assistantMsg(`${items.length} archived entries.`, 'search-results', results)
              );
            }
          } catch {
            removeThinking();
            addMessages(assistantMsg('Failed to fetch archived entries.'));
          }
          break;
        }

        case 'confidence': {
          if (!cmd.text) return;
          const newConf = cmd.confidence ?? 'firm';
          try {
            // Find the entry in the brain to get its section
            const section = cmd.section ?? findSectionForText(cmd.text);
            if (!section) {
              addMessages(assistantMsg(`Could not find entry: "${cmd.text}". Try specifying the section.`));
              return;
            }
            await brain.setConfidence.mutateAsync({
              section,
              text: cmd.text,
              confidence: newConf,
            });
            addMessages(assistantMsg(`Marked as ${newConf}: "${cmd.text}".`));
          } catch {
            addMessages(assistantMsg('Failed to set confidence.'));
          }
          break;
        }

        case 'resolve': {
          if (!cmd.text) return;
          try {
            await brain.postMemory.mutateAsync({
              section: 'decisions',
              action: 'resolve',
              value: cmd.text,
              source: 'brain-app',
            });
            addMessages(assistantMsg(`Resolved: "${cmd.text}".`));
          } catch {
            addMessages(assistantMsg('Failed to resolve decision.'));
          }
          break;
        }

        case 'mission': {
          if (!cmd.missionName) return;
          try {
            if (cmd.tasks && cmd.tasks.length > 0) {
              // Check if this is "add task" to existing mission
              const existingMissions = missions.data ?? [];
              const existing = existingMissions.find(
                (m) => m.name.toLowerCase() === cmd.missionName!.toLowerCase()
              );
              if (existing) {
                await missions.addTasks.mutateAsync({
                  missionId: existing.id,
                  tasks: cmd.tasks.map((t) => ({ description: t })),
                });
                addMessages(
                  assistantMsg(`Added ${cmd.tasks.length} task(s) to mission "${cmd.missionName}".`)
                );
              } else {
                await missions.createMission.mutateAsync({
                  name: cmd.missionName,
                  project: activeProject || undefined,
                  tasks: cmd.tasks.map((t) => ({ description: t })),
                });
                addMessages(
                  assistantMsg(
                    `Created mission "${cmd.missionName}" with ${cmd.tasks.length} task(s).`
                  )
                );
              }
            } else {
              await missions.createMission.mutateAsync({
                name: cmd.missionName,
                project: activeProject || undefined,
              });
              addMessages(assistantMsg(`Created mission "${cmd.missionName}".`));
            }
          } catch {
            addMessages(assistantMsg('Failed to create/update mission.'));
          }
          break;
        }

        case 'missionStatus': {
          const thinking = assistantMsg('', 'thinking');
          addMessages(thinking);
          try {
            const data = await missions.refetch();
            removeThinking();
            const items = data.data ?? [];
            if (items.length === 0) {
              addMessages(assistantMsg('No active missions.'));
            } else {
              const lines = items.map((m) => {
                const c = m.taskCounts;
                return `${m.status === 'active' ? '\u25b6' : '\u2713'} ${m.name} \u2014 ${c.completed}/${c.pending + c.in_progress + c.completed + c.blocked} tasks done${c.blocked > 0 ? `, ${c.blocked} blocked` : ''}.`;
              });
              addMessages(assistantMsg('', 'batch', lines));
            }
          } catch {
            removeThinking();
            addMessages(assistantMsg('Failed to fetch missions.'));
          }
          break;
        }

        case 'export': {
          try {
            const data = await api.getBrain(activeProject || undefined);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brain-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addMessages(assistantMsg('Brain exported.'));
          } catch {
            addMessages(assistantMsg('Failed to export brain.'));
          }
          break;
        }

        case 'clearLog': {
          try {
            await api.clearLog();
            addMessages(assistantMsg('Activity log cleared.'));
          } catch {
            addMessages(assistantMsg('Failed to clear log.'));
          }
          break;
        }

        case 'projectClose': {
          if (!cmd.projectId) return;
          try {
            await api.closeProject({ id: cmd.projectId });
            addMessages(assistantMsg(`Closed project "${cmd.projectId}".`));
          } catch {
            addMessages(assistantMsg('Failed to close project.'));
          }
          break;
        }

        case 'projectReopen': {
          if (!cmd.projectId) return;
          try {
            await api.reopenProject({ id: cmd.projectId });
            addMessages(assistantMsg(`Reopened project "${cmd.projectId}".`));
          } catch {
            addMessages(assistantMsg('Failed to reopen project.'));
          }
          break;
        }

        case 'batch': {
          if (!cmd.commands) return;
          const results: string[] = [];
          for (const sub of cmd.commands) {
            try {
              // Execute each sub-command and collect a summary line
              const tempMessages: ChatMessage[] = [];
              const origAdd = addMessages;
              // We collect results inline rather than adding individually
              await executeCommand(sub, '');
            } catch {
              results.push(`Failed: ${sub.type}`);
            }
          }
          break;
        }
      }
    },
    [brain, archived, missions, activeProject, addMessages, removeThinking]
  );

  // Helper: find which section an entry belongs to by text match
  const findSectionForText = useCallback(
    (text: string): SectionName | undefined => {
      const data = brain.data;
      if (!data) return undefined;
      const lower = text.toLowerCase();
      for (const section of ['workingStyle', 'architecture', 'agentRules'] as const) {
        if (data[section]?.some((e) => entryText(e).toLowerCase().includes(lower))) {
          return section;
        }
      }
      if (data.decisions?.some((d) => d.decision.toLowerCase().includes(lower))) {
        return 'decisions';
      }
      return undefined;
    },
    [brain.data]
  );

  const handleSend = useCallback(async () => {
    const raw = input.trim();
    if (!raw) return;
    setInput('');

    addMessages(userMsg(raw));
    const cmd = parseCommand(raw);

    if (cmd.type === 'batch' && cmd.commands) {
      for (const sub of cmd.commands) {
        await executeCommand(sub, raw);
      }
    } else {
      await executeCommand(cmd, raw);
    }
  }, [input, addMessages, executeCommand]);

  const handleArchiveResult = useCallback(
    async (result: SearchResult) => {
      try {
        await archived.archive.mutateAsync({
          section: result.section as SectionName,
          text: entryText(result.entry),
        });
        addMessages(assistantMsg(`Archived: "${entryText(result.entry)}".`));
      } catch {
        addMessages(assistantMsg('Failed to archive.'));
      }
    },
    [archived, addMessages]
  );

  const handleToggleConfidence = useCallback(
    async (result: SearchResult) => {
      const entry = result.entry;
      const newConf = entry.confidence === 'firm' ? 'tentative' : 'firm';
      try {
        await brain.setConfidence.mutateAsync({
          section: result.section as SectionName,
          text: entryText(entry),
          confidence: newConf,
        });
        addMessages(assistantMsg(`Marked as ${newConf}: "${entryText(entry)}".`));
      } catch {
        addMessages(assistantMsg('Failed to update confidence.'));
      }
    },
    [brain, addMessages]
  );

  const handleConflictAddAnyway = useCallback(async () => {
    if (pendingConflictAdd) {
      await pendingConflictAdd();
      setPendingConflictAdd(null);
    }
  }, [pendingConflictAdd]);

  const handleConflictCancel = useCallback(() => {
    setPendingConflictAdd(null);
    addMessages(assistantMsg('Cancelled.'));
  }, [addMessages]);

  const handleInsertPrefix = useCallback((prefix: string) => {
    setInput(prefix);
  }, []);

  const handleTriggerAction = useCallback(
    (action: string) => {
      setInput('');
      addMessages(userMsg(action));
      const cmd = parseCommand(action);
      executeCommand(cmd, action);
    },
    [addMessages, executeCommand]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setInput('');
    setPendingConflictAdd(null);
  }, []);

  return (
    <aside className="flex flex-col w-[340px] flex-shrink-0 border-l border-[#62627a]/20 bg-brain-raised">
      <CommandHeader onClear={handleClear} />
      <Separator className="bg-[#62627a]/20" />

      <ChatMessages
        messages={messages}
        onSuggestionSelect={(text) => handleTriggerAction(text)}
        onArchiveResult={handleArchiveResult}
        onToggleConfidence={handleToggleConfidence}
        onConflictAddAnyway={handleConflictAddAnyway}
        onConflictCancel={handleConflictCancel}
      />

      <QuickActions onInsertPrefix={handleInsertPrefix} onTriggerAction={handleTriggerAction} />
      <CommandInput value={input} onChange={setInput} onSend={handleSend} />
    </aside>
  );
}
