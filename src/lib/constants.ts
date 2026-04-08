export const SECTIONS = ['workingStyle', 'architecture', 'agentRules', 'decisions'] as const;

export const SECTION_COLORS: Record<string, string> = {
  workingStyle: '#a78bfa',
  architecture: '#22d3ee',
  agentRules: '#34d399',
  decisions: '#fbbf24',
};

export const SECTION_LABELS: Record<string, string> = {
  workingStyle: 'Working Style',
  architecture: 'Architecture',
  agentRules: 'Agent Rules',
  decisions: 'Decisions',
};

// Physics constants for neural map.
export const REPULSION = 800;
export const ATTRACTION = 0.06;
export const DAMPING = 0.88;
export const CENTER_GRAVITY = 0.002;
export const MAX_SPEED = 4;
export const SIM_THRESHOLD = 0.15;

// Task status icons.
export const TASK_STATUS_ICONS: Record<string, { icon: string; cls: string }> = {
  pending: { icon: '○', cls: 'pending' },
  in_progress: { icon: '▶', cls: 'in_progress' },
  completed: { icon: '✓', cls: 'completed' },
  blocked: { icon: '!', cls: 'blocked' },
  interrupted: { icon: '⏸', cls: 'interrupted' },
  verification_failed: { icon: '✗', cls: 'verification_failed' },
};
