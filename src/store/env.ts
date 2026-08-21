/**
 * @module store/env
 * Persisted store for global PTY environment variables.
 *
 * Every PTY spawned by the app inherits these vars.
 * Changes take effect on the next PTY spawn — active sessions must be
 * refreshed manually; inactive sessions are killed automatically on save.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { shortId } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvVar {
  id: string;
  key: string;
  value: string;
}

interface EnvState {
  envVars: EnvVar[];

  addVar: () => void;
  updateVar: (id: string, field: "key" | "value", text: string) => void;
  removeVar: (id: string) => void;
  /** Replace the entire list (used on save). */
  setVars: (vars: EnvVar[]) => void;

  /**
   * Returns a plain `Record<string, string>` for passing to PTY spawn.
   * Skips entries with empty keys.
   */
  toRecord: () => Record<string, string>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEnvStore = create<EnvState>()(
  persist(
    (set, get) => ({
      envVars: [],

      addVar: () =>
        set((s) => ({
          envVars: [...s.envVars, { id: shortId(), key: "", value: "" }],
        })),

      updateVar: (id, field, text) =>
        set((s) => ({
          envVars: s.envVars.map((v) => (v.id === id ? { ...v, [field]: text } : v)),
        })),

      removeVar: (id) => set((s) => ({ envVars: s.envVars.filter((v) => v.id !== id) })),

      setVars: (vars) => set({ envVars: vars }),

      toRecord: () => {
        const record: Record<string, string> = {};
        for (const { key, value } of get().envVars) {
          if (key.trim()) record[key.trim()] = value;
        }
        return record;
      },
    }),
    { name: "piarc-env-vars" }
  )
);
