import { create } from "zustand";

import { type OmpStatus, getOmpStatus } from "@/lib/ipc";

interface OmpState {
  status: OmpStatus | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useOmpStore = create<OmpState>()((set) => ({
  status: null,
  isLoading: false,
  refresh: async () => {
    set({ isLoading: true });
    try {
      set({ status: await getOmpStatus(), isLoading: false });
    } catch (error) {
      set({
        status: {
          installed: false,
          path: null,
          version: null,
          error: error instanceof Error ? error.message : String(error),
        },
        isLoading: false,
      });
    }
  },
}));
