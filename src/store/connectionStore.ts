import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'demo';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (s: ConnectionStatus) => void;
}

export const useConnection = create<ConnectionState>((set) => ({
  status: 'connecting',
  setStatus: (status) => set({ status }),
}));
