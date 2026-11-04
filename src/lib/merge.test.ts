import { describe, it, expect } from "vitest";
import { mergeById, purgeTombstones } from "./merge";

type Item = { id: string; text?: string; updatedAt?: string; deletedAt?: string };

const T1 = "2026-01-01T10:00:00.000Z";
const T2 = "2026-01-01T11:00:00.000Z";
const T3 = "2026-01-01T12:00:00.000Z";

describe("mergeById", () => {
  it("keeps items that exist on only one side", () => {
    const merged = mergeById<Item>([{ id: "a", updatedAt: T1 }], [{ id: "b", updatedAt: T1 }]);
    expect(merged.map(i => i.id).sort()).toEqual(["a", "b"]);
  });

  it("takes the newer edit", () => {
    const merged = mergeById<Item>(
      [{ id: "a", text: "old", updatedAt: T1 }],
      [{ id: "a", text: "new", updatedAt: T2 }],
    );
    expect(merged).toEqual([{ id: "a", text: "new", updatedAt: T2 }]);
  });

  it("lets a delete made after an edit win, keeping the tombstone", () => {
    const merged = mergeById<Item>(
      [{ id: "a", text: "x", updatedAt: T1 }],
      [{ id: "a", text: "x", updatedAt: T1, deletedAt: T2 }],
    );
    expect(merged[0].deletedAt).toBe(T2);
  });

  it("lets a restore made after a delete win", () => {
    // Restore = deletedAt cleared, updatedAt bumped past the tombstone.
    const merged = mergeById<Item>(
      [{ id: "a", updatedAt: T1, deletedAt: T2 }],
      [{ id: "a", updatedAt: T3 }],
    );
    expect(merged[0].deletedAt).toBeUndefined();
    expect(merged[0].updatedAt).toBe(T3);
  });

  it("gives the same answer regardless of argument order", () => {
    const local: Item[] = [{ id: "a", updatedAt: T1, deletedAt: T2 }];
    const remote: Item[] = [{ id: "a", updatedAt: T3 }];
    expect(mergeById(local, remote)).toEqual(mergeById(remote, local));
  });
});

describe("purgeTombstones", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

  it("keeps live items and recent tombstones", () => {
    const items: Item[] = [{ id: "live" }, { id: "recent", deletedAt: ago(200) }];
    expect(purgeTombstones(items).map(i => i.id)).toEqual(["live", "recent"]);
  });

  it("drops tombstones older than a year by default", () => {
    const items: Item[] = [{ id: "old", deletedAt: ago(400) }, { id: "live" }];
    expect(purgeTombstones(items).map(i => i.id)).toEqual(["live"]);
  });

  it("respects an explicit window", () => {
    const items: Item[] = [{ id: "a", deletedAt: ago(40) }];
    expect(purgeTombstones(items, 30)).toEqual([]);
  });

  it("keeps a tombstone whose date can't be parsed", () => {
    const items: Item[] = [{ id: "a", deletedAt: "not-a-date" }];
    expect(purgeTombstones(items)).toHaveLength(1);
  });
});
