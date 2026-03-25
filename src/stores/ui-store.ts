import { create } from 'zustand';

interface UIState {
  activeTab: 'neural' | 'metrics' | 'missions';
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
  activeTab: 'neural',
  activeFilter: 'all',
  activeProject: '',
  sessionFilterId: '',
  graphProjectFilterId: '',
  serverLive: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setActiveProject: (project) => set({ activeProject: project }),
  setSessionFilterId: (id) => set({ sessionFilterId: id }),
  setGraphProjectFilterId: (id) => set({ graphProjectFilterId: id }),
  setServerLive: (live) => set({ serverLive: live }),
}));
