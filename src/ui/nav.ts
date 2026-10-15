import { create } from 'zustand';

export type Tab = 'home' | 'review' | 'tracker' | 'profile';
export type Screen = { name: 'job'; id: string } | { name: 'settings' } | { name: 'editProfile'; section?: string };

interface Nav {
  tab: Tab;
  stack: Screen[];
  dir: 1 | -1;
  setTab: (t: Tab) => void;
  push: (s: Screen) => void;
  pop: () => boolean;
}

export const useNav = create<Nav>((set, get) => ({
  tab: 'home',
  stack: [],
  dir: 1,
  setTab: (tab) => set({ tab, stack: [] }),
  push: (s) => set((st) => ({ stack: [...st.stack, s], dir: 1 })),
  pop: () => {
    if (!get().stack.length) return false;
    set((st) => ({ stack: st.stack.slice(0, -1), dir: -1 }));
    return true;
  },
}));
