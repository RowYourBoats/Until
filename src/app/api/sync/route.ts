import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic, PERSIST_DISABLED } from "@/lib/atomicWrite";
import { reconcileEventFolders } from "@/lib/eventFolders";
import { mergeById, purgeTombstones, Mergeable } from "@/lib/merge";

/**
 * Two-way sync endpoint. The phone POSTs its full snapshot of all four datasets;
 * we merge each into the PC's files (last-write-wins per item, tombstones kept),
 * reconcile the event folders, persist, and return the merged datasets so the
 * phone overwrites its local copies. The PC stays the source of truth on disk.
 */

const dataDir = path.join(process.cwd(), "data");
const files = {
  events: path.join(dataDir, "events.json"),
  dailyTasks: path.join(dataDir, "daily-tasks.json"),
  rhei: path.join(dataDir, "rhei.json"),
  pomodoroSessions: path.join(dataDir, "pomodoro-sessions.json"),
};

async function readArray(file: string): Promise<any[]> {
  try {
    const data = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asArray(v: unknown): Mergeable[] {
  return Array.isArray(v) ? (v as Mergeable[]) : [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incoming = {
      events: asArray(body?.events),
      dailyTasks: asArray(body?.dailyTasks),
      rhei: asArray(body?.rhei),
      pomodoroSessions: asArray(body?.pomodoroSessions),
    };

    // Read-only demo (Vercel): merge against an empty PC so the phone at least gets
    // its own data back, but persist nothing.
    if (PERSIST_DISABLED) {
      return NextResponse.json({ ...incoming, persisted: false });
    }

    const current = {
      events: await readArray(files.events),
      dailyTasks: await readArray(files.dailyTasks),
      rhei: await readArray(files.rhei),
      pomodoroSessions: await readArray(files.pomodoroSessions),
    };

    const mergedEvents = purgeTombstones(mergeById(current.events, incoming.events));
    const mergedDaily = purgeTombstones(mergeById(current.dailyTasks, incoming.dailyTasks));
    const mergedRhei = purgeTombstones(mergeById(current.rhei, incoming.rhei));
    const mergedPomodoro = mergeById(current.pomodoroSessions, incoming.pomodoroSessions);

    // Folders follow the merged events (creates, renames, trash for new tombstones).
    await reconcileEventFolders(current.events, mergedEvents);

    await writeJsonAtomic(files.events, mergedEvents);
    await writeJsonAtomic(files.dailyTasks, mergedDaily);
    await writeJsonAtomic(files.rhei, mergedRhei);
    await writeJsonAtomic(files.pomodoroSessions, mergedPomodoro);

    return NextResponse.json({
      events: mergedEvents,
      dailyTasks: mergedDaily,
      rhei: mergedRhei,
      pomodoroSessions: mergedPomodoro,
      persisted: true,
    });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
