import { create } from "zustand";

import {
  type OmpStatus,
  type OmpUpdate,
  checkOmpUpdate,
  getOmpStatus,
  installOmpUpdate,
} from "@/lib/ipc";

export type OmpUpdateState = "idle" | "checking" | "updating" | "error";

interface OmpState {
  status: OmpStatus | null;
  isLoading: boolean;
  update: OmpUpdate | null;
  updateState: OmpUpdateState;
  updateError: string | null;
  refresh: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
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
  update: null,
  updateState: "idle",
  updateError: null,
  checkForUpdate: async () => {
    set({ updateState: "checking", updateError: null });
    try {
      set({ update: await checkOmpUpdate(), updateState: "idle" });
    } catch (error) {
      set({
        updateState: "error",
        updateError: error instanceof Error ? error.message : String(error),
      });
    }
  },
  installUpdate: async () => {
    set({ updateState: "updating", updateError: null });
    try {
      const status = await installOmpUpdate();
      const update = await checkOmpUpdate();
      set({ status, update, updateState: "idle" });
    } catch (error) {
      set({
        updateState: "error",
        updateError: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
