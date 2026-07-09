import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Creator } from "@/types";

interface GriotStore {
  creator: Creator | null;
  setCreator: (creator: Creator | null) => void;
  agentBudget: number;
  setAgentBudget: (budget: number) => void;
}

// Persisted to localStorage so a signed-in creator survives a page reload
// instead of being asked to sign up again every time.
export const useGriotStore = create<GriotStore>()(
  persist(
    (set) => ({
      creator: null,
      setCreator: (creator) => set({ creator }),
      agentBudget: 0.5,
      setAgentBudget: (agentBudget) => set({ agentBudget }),
    }),
    {
      name: "griot-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
