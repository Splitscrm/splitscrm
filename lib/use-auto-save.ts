"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

// ─── Single-record auto-save ────────────────────────────────────────────────

interface UseAutoSaveOptions {
  data: Record<string, any> | null;
  saveFn: () => Promise<{ error?: string | null }>;
  enabled?: boolean;
  debounceMs?: number;
}

export function useAutoSave({
  data,
  saveFn,
  enabled = true,
  debounceMs = 2000,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const snapshotRef = useRef<string>("");
  const lastDirtyRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const dataRef = useRef(data);
  const saveFnRef = useRef(saveFn);

  dataRef.current = data;
  saveFnRef.current = saveFn;

  const currentJson = enabled && data ? JSON.stringify(data) : "";

  // Initialize snapshot on first enabled data
  useEffect(() => {
    if (enabled && currentJson && !snapshotRef.current) {
      snapshotRef.current = currentJson;
      lastDirtyRef.current = "";
    }
  }, [enabled, currentJson]);

  const doSave = useCallback(async (): Promise<{ error?: string | null }> => {
    if (savingRef.current) {
      queuedRef.current = true;
      return { error: null };
    }

    const snapshot = JSON.stringify(dataRef.current);
    if (snapshot === snapshotRef.current) {
      setStatus("idle");
      return { error: null };
    }

    savingRef.current = true;
    setStatus("saving");

    try {
      const result = await saveFnRef.current();
      if (result.error) {
        setStatus("error");
        return { error: result.error };
      } else {
        snapshotRef.current = snapshot;
        lastDirtyRef.current = "";
        const nowJson = JSON.stringify(dataRef.current);
        setStatus(nowJson === snapshot ? "saved" : "unsaved");
        return { error: null };
      }
    } catch (e: any) {
      setStatus("error");
      return { error: e?.message || "Save failed" };
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        doSave();
      }
    }
  }, []);

  // Detect changes and debounce
  useEffect(() => {
    if (!enabled || !currentJson || !snapshotRef.current) return;
    if (currentJson === snapshotRef.current) return;
    if (currentJson === lastDirtyRef.current) return;
    lastDirtyRef.current = currentJson;

    setStatus((prev) => (prev === "saving" ? prev : "unsaved"));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, debounceMs);
  });

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "unsaved" || status === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const forceSave = useCallback(async (): Promise<{ error?: string | null }> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastDirtyRef.current = "";
    return doSave();
  }, [doSave]);

  const resetSnapshot = useCallback(() => {
    snapshotRef.current = JSON.stringify(dataRef.current);
    lastDirtyRef.current = "";
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("idle");
  }, []);

  return { status, forceSave, resetSnapshot };
}

// ─── Collection auto-save (for arrays of independently-saveable items) ──────

interface UseCollectionAutoSaveOptions<T> {
  items: T[];
  getKey: (item: T) => string;
  saveFn: (item: T) => Promise<{ error?: string | null; snapshot?: T }>;
  enabled?: boolean;
  debounceMs?: number;
}

export function useCollectionAutoSave<T extends Record<string, any>>({
  items,
  getKey,
  saveFn,
  enabled = true,
  debounceMs = 2000,
}: UseCollectionAutoSaveOptions<T>) {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const snapshotsRef = useRef<Record<string, string>>({});
  const lastDirtyRef = useRef<Record<string, string>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savingRef = useRef<Record<string, boolean>>({});
  const itemsRef = useRef(items);
  const saveFnRef = useRef(saveFn);
  const getKeyRef = useRef(getKey);

  itemsRef.current = items;
  saveFnRef.current = saveFn;
  getKeyRef.current = getKey;

  const doItemSave = useCallback(async (key: string) => {
    if (savingRef.current[key]) return;

    const item = itemsRef.current.find((i) => getKeyRef.current(i) === key);
    if (!item) return;

    savingRef.current[key] = true;
    setStatuses((prev) => ({ ...prev, [key]: "saving" }));

    try {
      const result = await saveFnRef.current(item);
      if (result.error) {
        setStatuses((prev) => ({ ...prev, [key]: "error" }));
      } else {
        const snap = result.snapshot
          ? JSON.stringify(result.snapshot)
          : JSON.stringify(item);
        snapshotsRef.current[key] = snap;
        lastDirtyRef.current[key] = "";
        const nowItem = itemsRef.current.find((i) => getKeyRef.current(i) === key);
        const nowJson = nowItem ? JSON.stringify(nowItem) : "";
        setStatuses((prev) => ({
          ...prev,
          [key]: nowJson === snap ? "saved" : "unsaved",
        }));
      }
    } catch {
      setStatuses((prev) => ({ ...prev, [key]: "error" }));
    } finally {
      savingRef.current[key] = false;
    }
  }, []);

  // Detect per-item changes
  useEffect(() => {
    if (!enabled) return;

    for (const item of items) {
      const key = getKey(item);
      if (!key) continue;

      const json = JSON.stringify(item);

      if (!(key in snapshotsRef.current)) {
        snapshotsRef.current[key] = json;
        continue;
      }

      if (json === snapshotsRef.current[key]) continue;
      if (json === lastDirtyRef.current[key]) continue;
      lastDirtyRef.current[key] = json;

      setStatuses((prev) => {
        if (prev[key] === "saving" || prev[key] === "unsaved") return prev;
        return { ...prev, [key]: "unsaved" };
      });

      if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(() => doItemSave(key), debounceMs);
    }

    // Cleanup removed items
    const currentKeys = new Set(items.map(getKey));
    for (const key of Object.keys(snapshotsRef.current)) {
      if (!currentKeys.has(key)) {
        delete snapshotsRef.current[key];
        delete lastDirtyRef.current[key];
        if (timersRef.current[key]) {
          clearTimeout(timersRef.current[key]);
          delete timersRef.current[key];
        }
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  }); // Intentionally no deps — runs every render to compare items

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(timersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const vals = Object.values(statuses);
      if (vals.includes("unsaved") || vals.includes("saving")) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [statuses]);

  const overallStatus = useMemo((): SaveStatus => {
    const vals = Object.values(statuses);
    if (vals.includes("error")) return "error";
    if (vals.includes("saving")) return "saving";
    if (vals.includes("unsaved")) return "unsaved";
    if (vals.includes("saved")) return "saved";
    return "idle";
  }, [statuses]);

  const forceSave = useCallback(
    (key: string) => {
      if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
      lastDirtyRef.current[key] = "";
      doItemSave(key);
    },
    [doItemSave]
  );

  const forceSaveAll = useCallback(() => {
    for (const item of itemsRef.current) {
      const key = getKeyRef.current(item);
      if (key && JSON.stringify(item) !== snapshotsRef.current[key]) {
        forceSave(key);
      }
    }
  }, [forceSave]);

  const resetSnapshots = useCallback(() => {
    for (const item of itemsRef.current) {
      const key = getKeyRef.current(item);
      if (key) {
        snapshotsRef.current[key] = JSON.stringify(item);
        lastDirtyRef.current[key] = "";
      }
    }
    for (const timer of Object.values(timersRef.current)) {
      clearTimeout(timer);
    }
    setStatuses({});
  }, []);

  return { statuses, overallStatus, forceSave, forceSaveAll, resetSnapshots };
}

// ─── Combine statuses from multiple hooks ───────────────────────────────────

export function combineSaveStatuses(...args: SaveStatus[]): SaveStatus {
  if (args.includes("error")) return "error";
  if (args.includes("saving")) return "saving";
  if (args.includes("unsaved")) return "unsaved";
  if (args.includes("saved")) return "saved";
  return "idle";
}
