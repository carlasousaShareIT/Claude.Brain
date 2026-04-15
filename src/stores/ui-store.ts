import { create } from 'zustand';

export type DetailView = 'neural' | 'metrics' | 'missions' | 'sessions' | 'reminders' | 'experiments' | 'observer' | 'analytics';
export type ActiveView = 'dashboard' | DetailView;

const VALID_VIEWS: ActiveView[] = ['dashboard', 'neural', 'metrics', 'missions', 'sessions', 'reminders', 'experiments', 'observer', 'analytics'];

function viewFromHash(): ActiveView {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'dashboard') return 'dashboard';
  return (VALID_VIEWS as string[]).includes(hash) ? (hash as ActiveView) : 'dashboard';
}

interface UIState {
  activeView: ActiveView;
  activeFilter: string;
  activeProject: string;
  sessionFilterId: string;
  graphProjectFilterId: string;
  serverLive: boolean;
  commandPanelOpen: boolean;
  helpExpanded: boolean;
  pushView: (view: ActiveView) => void;
  popView: () => void;
  setActiveFilter: (filter: string) => void;
  setActiveProject: (project: string) => void;
  setSessionFilterId: (id: string) => void;
  setGraphProjectFilterId: (id: string) => void;
  setServerLive: (live: boolean) => void;
  setCommandPanelOpen: (open: boolean) => void;
  setHelpExpanded: (expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: viewFromHash(),
  activeFilter: 'all',
  activeProject: '',
  sessionFilterId: '',
  graphProjectFilterId: '',
  serverLive: false,
  commandPanelOpen: false,
  helpExpanded: false,
  pushView: (view) => {
    window.location.hash = view === 'dashboard' ? '' : view;
    set({ activeView: view });
  },
  popView: () => {
    window.location.hash = '';
    set({ activeView: 'dashboard' });
  },
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setActiveProject: (project) => set({ activeProject: project }),
  setSessionFilterId: (id) => set({ sessionFilterId: id }),
  setGraphProjectFilterId: (id) => set({ graphProjectFilterId: id }),
  setServerLive: (live) => set({ serverLive: live }),
  setCommandPanelOpen: (open) => set({ commandPanelOpen: open }),
  setHelpExpanded: (expanded) => set({ helpExpanded: expanded }),
}));
