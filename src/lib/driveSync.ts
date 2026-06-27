/**
 * Drive round-trip orchestration: read the shared file, merge it with the local
 * snapshot per item (last-write-wins, tombstones kept), optionally let the PC fold
 * in its disk + reconcile project folders, then write the result back to Drive.
 *
 * Local state/localStorage are adopted by the caller only AFTER the write
 * succeeds, so a clobbered write never loses data — the device's local items
 * (with their `updatedAt`) just re-merge and re-push on the next sync.
 */

import { mergeById, purgeTombstones } from "@/lib/merge";
import { findOrCreateDataFile, getAccessToken, getHeadRevisionId, readDataFile, writeDataFile } from "@/lib/drive";

export interface AllDatasets {
  events: any[];
  dailyTasks: any[];
  rhei: any[];
  pomodoroSessions: any[];
}

/**
 * On the PC, persist the merged set to disk and reconcile project folders, then
 * return the authoritative set the server produced (it folds in any disk-only
 * items). Undefined on the phone/MacBook, which sync to Drive only.
 */
export type Persist = (merged: AllDatasets) => Promise<AllDatasets>;

function mergeAll(local: AllDatasets, remote: AllDatasets): AllDatasets {
  return {
    events: purgeTombstones(mergeById(local.events, remote.events)),
    dailyTasks: purgeTombstones(mergeById(local.dailyTasks, remote.dailyTasks)),
    rhei: purgeTombstones(mergeById(local.rhei, remote.rhei)),
    // Pomodoro sessions have no tombstones (matches /api/sync).
    pomodoroSessions: mergeById(local.pomodoroSessions, remote.pomodoroSessions),
  };
}

export async function syncWithDrive(local: AllDatasets, persist?: Persist): Promise<AllDatasets> {
  const token = await getAccessToken(true);
  const { id } = await findOrCreateDataFile(token);

  // Retry on a concurrent write: if the file's revision changed between our read
  // and our write, another device synced in the gap — re-read and re-merge.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: remote, headRevisionId } = await readDataFile(token, id);
    let merged = mergeAll(local, remote);
    if (persist) merged = await persist(merged);

    const current = await getHeadRevisionId(token, id);
    if (current !== headRevisionId) continue; // someone wrote; start over

    await writeDataFile(token, id, merged);
    return merged;
  }

  throw new Error("conflicting syncs — try again");
}
