import { create } from 'zustand';

type ActiveTab = 'neural' | 'metrics' | 'missions' | 'sessions' | 'reminders';

const VALID_TABS: ActiveTab[] = ['neural', 'metrics', 'missions', 'sessions', 'reminders'];

function tabFromHash(): ActiveTab {
  const hash = window.location.hash.replace('#', '');
  return (VALID_TABS as string[]).includes(hash) ? (hash as ActiveTab) : 'neural';
}

interface UIState {
  activeTab: ActiveTab;
  activeFilter: string;
  activeProject: string;
  sessionFilterId: string;
  graphProjectFilterId: string;
  serverLive: boolean;
  setActiveTab: (tab: UIState['activeTab']) => void;
  setActiveFilter: (filter: string) => void;
  setActiveProject: (project: string) => void;
  setSessionFilterId: (id: string) => void;
  setGraphProjectFilterId: (id: string) => void;
  setServerLive: (live: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: tabFromHash(),
  activeFilter: 'all',
  activeProject: '',
  sessionFilterId: '',
  graphProjectFilterId: '',
  serverLive: false,
  setActiveTab: (tab) => {
    window.location.hash = tab;
    set({ activeTab: tab });
  },
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setActiveProject: (project) => set({ activeProject: project }),
  setSessionFilterId: (id) => set({ sessionFilterId: id }),
  setGraphProjectFilterId: (id) => set({ graphProjectFilterId: id }),
  setServerLive: (live) => set({ serverLive: live }),
}));
