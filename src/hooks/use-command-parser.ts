import type { SectionName } from '@/lib/types';

export interface ParsedCommand {
  type:
    | 'add'
    | 'search'
    | 'archive'
    | 'unarchive'
    | 'confidence'
    | 'resolve'
    | 'mission'
    | 'missionStatus'
    | 'export'
    | 'clearLog'
    | 'projectClose'
    | 'projectReopen'
    | 'showArchived'
    | 'batch';
  section?: SectionName;
  text?: string;
  confidence?: 'firm' | 'tentative';
  missionName?: string;
  tasks?: string[];
  projectId?: string;
  natural?: boolean;
  commands?: ParsedCommand[];
}

const SECTION_ALIASES: Record<string, SectionName> = {
  style: 'workingStyle',
  'working style': 'workingStyle',
  workingstyle: 'workingStyle',
  arch: 'architecture',
  architecture: 'architecture',
  rule: 'agentRules',
  rules: 'agentRules',
  agentrules: 'agentRules',
  decision: 'decisions',
  decisions: 'decisions',
};

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[?.!,;:]+$/, '');
}

function resolveSection(raw: string): SectionName | undefined {
  return SECTION_ALIASES[raw.trim().toLowerCase()];
}

function parseSingle(input: string): ParsedCommand {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // clear log
  if (lower === 'clear log') {
    return { type: 'clearLog' };
  }

  // export
  if (lower === 'export') {
    return { type: 'export' };
  }

  // mission status
  if (lower === 'mission status') {
    return { type: 'missionStatus' };
  }

  // show archived
  if (lower === 'show archived') {
    return { type: 'showArchived' };
  }

  // close project: id
  const closeMatch = trimmed.match(/^close project:\s*(.+)/i);
  if (closeMatch) {
    return { type: 'projectClose', projectId: closeMatch[1].trim() };
  }

  // reopen project: id
  const reopenMatch = trimmed.match(/^reopen project:\s*(.+)/i);
  if (reopenMatch) {
    return { type: 'projectReopen', projectId: reopenMatch[1].trim() };
  }

  // unarchive: text
  const unarchiveMatch = trimmed.match(/^unarchive:\s*(.+)/i);
  if (unarchiveMatch) {
    return { type: 'unarchive', text: unarchiveMatch[1].trim() };
  }

  // archive section: text
  const archiveMatch = trimmed.match(/^archive\s+(\w+):\s*(.+)/i);
  if (archiveMatch) {
    const section = resolveSection(archiveMatch[1]);
    if (section) {
      return { type: 'archive', section, text: archiveMatch[2].trim() };
    }
  }

  // resolve: text
  const resolveMatch = trimmed.match(/^resolve:\s*(.+)/i);
  if (resolveMatch) {
    return { type: 'resolve', text: resolveMatch[1].trim() };
  }

  // firm section: text / tentative section: text
  const confMatch = trimmed.match(/^(firm|tentative)\s+(\w+):\s*(.+)/i);
  if (confMatch) {
    const confidence = confMatch[1].toLowerCase() as 'firm' | 'tentative';
    const section = resolveSection(confMatch[2]);
    if (section) {
      return { type: 'confidence', confidence, section, text: confMatch[3].trim() };
    }
  }

  // mark X as firm/tentative
  const markMatch = trimmed.match(/^mark\s+(.+)\s+as\s+(firm|tentative)$/i);
  if (markMatch) {
    return {
      type: 'confidence',
      confidence: markMatch[2].toLowerCase() as 'firm' | 'tentative',
      text: markMatch[1].trim(),
    };
  }

  // add section: text
  const addMatch = trimmed.match(/^add\s+(\w[\w\s]*):\s*(.+)/i);
  if (addMatch) {
    const sectionKey = addMatch[1].trim().toLowerCase();
    if (sectionKey === 'natural') {
      return { type: 'add', natural: true, text: addMatch[2].trim() };
    }
    if (sectionKey === 'mission') {
      return { type: 'mission', missionName: addMatch[2].trim() };
    }
    if (sectionKey === 'task') {
      // add task: Mission Name | Task1; Task2
      const parts = addMatch[2].split('|').map((p) => p.trim());
      if (parts.length === 2) {
        return {
          type: 'mission',
          missionName: parts[0],
          tasks: parts[1].split(';').map((t) => t.trim()).filter(Boolean),
        };
      }
    }
    const section = resolveSection(sectionKey);
    if (section) {
      return { type: 'add', section, text: addMatch[2].trim() };
    }
  }

  // remember that ...
  const rememberMatch = trimmed.match(/^remember\s+that\s+(.+)/i);
  if (rememberMatch) {
    return { type: 'add', natural: true, text: rememberMatch[1].trim() };
  }

  // mission: Name | Task1; Task2; Task3
  const missionWithTasks = trimmed.match(/^mission:\s*(.+?)\s*\|\s*(.+)/i);
  if (missionWithTasks) {
    return {
      type: 'mission',
      missionName: missionWithTasks[1].trim(),
      tasks: missionWithTasks[2].split(';').map((t) => t.trim()).filter(Boolean),
    };
  }

  // search patterns
  const searchPatterns = [
    /^what do we know about\s+(.+)/i,
    /^find\s+(.+)/i,
    /^show me\s+(.+)/i,
    /^search\s+(.+)/i,
  ];
  for (const pattern of searchPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'search', text: stripTrailingPunctuation(match[1].trim()) };
    }
  }

  // default: treat as search
  return { type: 'search', text: stripTrailingPunctuation(trimmed) };
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'search', text: '' };
  }

  // batch: split by semicolons (but only top-level, not inside mission task lists)
  // We detect batch by checking if there are multiple distinct command patterns separated by ;
  // Simple heuristic: if the input contains | (mission syntax), don't split on ;
  if (!trimmed.includes('|') && trimmed.includes(';')) {
    const parts = trimmed.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return {
        type: 'batch',
        commands: parts.map(parseSingle),
      };
    }
  }

  return parseSingle(trimmed);
}
