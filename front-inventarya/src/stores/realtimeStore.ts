import { create } from 'zustand';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

interface RealtimeState {
  status: RealtimeStatus;
  setStatus: (status: RealtimeStatus) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
  reset: () => set({ status: 'disconnected' }),
}));
