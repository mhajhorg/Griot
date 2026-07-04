import { create } from "zustand";
import type { Creator } from "@/types";

interface GriotStore {
  creator: Creator | null;
  setCreator: (creator: Creator | null) => void;
  agentBudget: number;
  setAgentBudget: (budget: number) => void;
}

export const useGriotStore = create<GriotStore>((set) => ({
  creator: null,
  setCreator: (creator) => set({ creator }),
  agentBudget: 0.5,
  setAgentBudget: (agentBudget) => set({ agentBudget }),
}));
