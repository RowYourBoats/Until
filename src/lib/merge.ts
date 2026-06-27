/**
 * Last-write-wins merge for the offline sync. Each device keeps a full copy of a
 * dataset and edits offline; on sync the two copies are reconciled per item.
 *
 * Items are keyed by `id`. The "freshness" of an item is the latest of its
 * `updatedAt` and `deletedAt` stamps — so a delete made after an edit wins, and an
 * edit made after a delete (a restore) wins. Tombstones (items with `deletedAt`)
 * are KEPT in the merged result so a deletion on one device propagates instead of
 * the item resurrecting from the other device's stale copy. Call purgeTombstones
 * periodically to drop old ones.
 */

export interface Mergeable {
  id: string;
  updatedAt?: string;
  deletedAt?: string;
}

function freshness(item: Mergeable): string {
  const u = item.updatedAt || "";
  const d = item.deletedAt || "";
  return u > d ? u : d;
}

export function mergeById<T extends Mergeable>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.id);
    if (!existing || freshness(item) >= freshness(existing)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

/**
 * Drop tombstones older than `days`. Run on the source-of-truth side after a merge
 * so storage stays bounded; any device that deleted within the window has already
 * propagated the deletion.
 */
export function purgeTombstones<T extends Mergeable>(items: T[], days = 30): T[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    if (!item.deletedAt) return true;
    const t = Date.parse(item.deletedAt);
    return isNaN(t) || t >= cutoff;
  });
}
