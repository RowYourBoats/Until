"use client";

/**
 * Sync button state + driver. Owns `syncing`/`status` (the header reads them) and
 * wraps `syncWithDrive`: on success it hands the merged datasets to `apply` (which
 * commits them to React state + localStorage) and stamps the last-sync time.
 */

import { useCallback, useRef, useState } from "react";
import { saveLocal, LS_KEYS } from "@/lib/localStore";
import { syncWithDrive, AllDatasets, Persist } from "@/lib/driveSync";
import { formatSyncTime } from "@/lib/syncTime";

export function useDriveSync() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [needsLogin, setNeedsLogin] = useState(true);

  const sync = useCallback(
    async (local: AllDatasets, persist: Persist | undefined, apply: (merged: AllDatasets) => void, interactive = true) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSyncing(true);
      setStatus("Syncing…");
      try {
        const merged = await syncWithDrive(local, persist, interactive);
        apply(merged);
        const stamp = new Date().toISOString();
        saveLocal(LS_KEYS.lastSync, stamp);
        setStatus(`Synced ${formatSyncTime(stamp)}`);
        setNeedsLogin(false);
      } catch (e) {
        setNeedsLogin(true);
        // A silent (hourly) attempt failing is expected once the ~1h Google token
        // lapses — point at the button instead of raising an alarm.
        setStatus(interactive
          ? `Sync failed — ${(e as Error).message || "sign-in or network"}`
          : "Auto-sync paused — press Sync");
      } finally {
        inFlight.current = false;
        setSyncing(false);
      }
    },
    [],
  );

  return { sync, syncing, status, setStatus, needsLogin };
}
