import fs from "fs/promises";

/**
 * Vercel (and most serverless hosts) run with a read-only filesystem and ship
 * none of the gitignored `data/` dir — the app is a read-only demo there. When
 * this is set, persistence is a no-op: the client keeps its in-session state and
 * GET falls back to the bundled `data-example/` snapshot. Set UNTIL_READ_ONLY=1
 * to force the same behavior anywhere.
 */
export const PERSIST_DISABLED =
  process.env.VERCEL === "1" || process.env.UNTIL_READ_ONLY === "1";

/**
 * Write JSON to disk atomically: serialize, write a unique temp file in the same
 * directory, then rename it over the target. `fs.rename` is an atomic replace on
 * every OS, so a crash, power loss, or a cloud-sync grabbing the file mid-write
 * can never leave a truncated / half-written file — the target on disk is always
 * either the previous complete file or the new complete one. (Plain
 * `fs.writeFile` truncates *then* writes, leaving a window where the file is
 * empty or partial; that window is what corrupts data under sync.)
 *
 * Guards against corruption, NOT lost updates: two concurrent read-modify-write
 * cycles on the same file can still clobber each other (last rename wins). For
 * that, serialize writes or split into per-record files.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  if (PERSIST_DISABLED) return;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, filePath);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}
