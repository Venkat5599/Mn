"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Polls `load` every `intervalMs` while the tab is visible. Keeps the last good value on error,
 * so a dropped request never blanks the board.
 */
export function usePoll<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;

    const tick = async () => {
      if (document.visibilityState === "visible") {
        ctrl = new AbortController();
        try {
          const next = await loadRef.current(ctrl.signal);
          if (alive) {
            setData(next);
            setError(undefined);
          }
        } catch (err) {
          if (alive && !(err instanceof DOMException && err.name === "AbortError")) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      alive = false;
      ctrl?.abort();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, error };
}

/** Wall clock in seconds, ticking at `hz`. Drives countdowns without re-reading the chain. */
export function useNow(hz = 10) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return now;
}
