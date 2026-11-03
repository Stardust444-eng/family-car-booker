"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

export function usePoll<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const apply = useCallback((next: T) => {
    seq.current += 1;
    setData(next);
    setError(null);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const next = await api<T>(url);
      if (id !== seq.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof Error ? err.message : "Could not load the garage.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const startup = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(startup);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { data, error, loading, load, apply };
}
