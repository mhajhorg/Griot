import { useCallback, useEffect, useState } from "react";
import type { AgentCitation } from "@/types";

export interface StoredTurn {
  role: "user" | "agent";
  id: string;
  content?: string;
  attachment?: { name: string; type: string }; // stored without base64 to keep localStorage small
  status?: "done" | "error";
  summary?: string;
  citations?: AgentCitation[];
  spent?: number;
  errorMessage?: string;
}

export interface ChatSession {
  id: string;
  title: string; // derived from first user message
  createdAt: string;
  updatedAt: string;
  turns: StoredTurn[];
  totalSpent: number;
}

const STORAGE_KEY = "griot_chat_sessions";
const MAX_SESSIONS = 50; // avoid filling localStorage

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage can fail if quota is exceeded — fail silently
  }
}

export function useSessionHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Load from localStorage on mount (client only)
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const saveSession = useCallback(
    (session: ChatSession) => {
      setSessions((prev) => {
        const existing = prev.findIndex((s) => s.id === session.id);
        let next: ChatSession[];
        if (existing >= 0) {
          next = prev.map((s) => (s.id === session.id ? session : s));
        } else {
          next = [session, ...prev].slice(0, MAX_SESSIONS);
        }
        saveSessions(next);
        return next;
      });
    },
    []
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    saveSessions([]);
  }, []);

  return { sessions, saveSession, deleteSession, clearAll };
}
