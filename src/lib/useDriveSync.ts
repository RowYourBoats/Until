"use client";

/**
 * Sync button state + driver. Owns `syncing`/`status` (the header reads them) and
 * wraps `syncWithDrive`: on success it hands the merged datasets to `apply` (which
 * commits them to React state + localStorage) and stamps the last-sync time.
 */

import { useCallback, useState } from "react";
import { saveLocal, LS_KEYS } from "@/lib/localStore";
import { syncWithDrive, AllDatasets, Persist } from "@/lib/driveSync";

export function useDriveSync() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sync = useCallback(
    async (local: AllDatasets, persist: Persist | undefined, apply: (merged: AllDatasets) => void) => {
      if (syncing) return;
      setSyncing(true);
      setStatus("Syncing…");
      try {
        const merged = await syncWithDrive(local, persist);
        apply(merged);
        const stamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        saveLocal(LS_KEYS.lastSync, stamp);
        setStatus(`Synced ${stamp}`);
      } catch (e) {
        setStatus(`Sync failed — ${(e as Error).message || "sign-in or network"}`);
      } finally {
        setSyncing(false);
      }
    },
    [syncing],
  );

  return { sync, syncing, status, setStatus };
}
