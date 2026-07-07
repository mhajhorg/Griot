import { useCallback, useEffect, useRef, useState } from "react";
import { readerLogin, getReaderBalance } from "@/lib/api";
import type { ReaderSession } from "@/types";

const STORAGE_KEY = "griot_reader_session";

function loadCachedSession(): ReaderSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReaderSession) : null;
  } catch {
    return null;
  }
}

function cacheSession(session: ReaderSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

function clearCachedSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function useReaderSession() {
  const [session, setSession] = useState<ReaderSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: reuse a cached session from this browser if one exists.
  // Does NOT auto-login — a reader must explicitly enter their email first,
  // this only skips re-asking on a page refresh within the same session.
  useEffect(() => {
    const cached = loadCachedSession();
    if (cached) setSession(cached);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string) => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      const result = await readerLogin(email.trim());
      setSession(result);
      cacheSession(result);
      return result;
    } catch {
      setLoginError("Couldn't log you in. Try again.");
      return null;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setBalance(0);
    clearCachedSession();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!session) return;
    const result = await getReaderBalance(session.reader_id);
    setBalance(result.usdc_balance);
    return result.usdc_balance;
  }, [session]);

  // Fetch balance whenever a session becomes available.
  useEffect(() => {
    if (!session) return;
    refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      refreshBalance();
    }, 5000);
  }, [refreshBalance]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    session,
    loading,
    login,
    loggingIn,
    loginError,
    logout,
    balance,
    refreshBalance,
    startPolling,
    stopPolling,
  };
}
