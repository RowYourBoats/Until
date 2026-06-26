import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic, PERSIST_DISABLED } from "@/lib/atomicWrite";
import { rebaseExampleDates } from "@/lib/exampleData";
import { reconcileEventFolders } from "@/lib/eventFolders";

const filePath = path.join(process.cwd(), "data", "events.json");
const examplePath = path.join(process.cwd(), "data-example", "events.json");

export async function GET() {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    try {
      const data = await fs.readFile(examplePath, "utf8");
      return NextResponse.json(rebaseExampleDates(JSON.parse(data)));
    } catch {
      return NextResponse.json([], { status: 200 });
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isWrapped = body && !Array.isArray(body) && body.events;
    const newEvents = isWrapped ? body.events : body;
    // Legacy callers passed deleted events separately; current clients tombstone
    // them in-array (deletedAt), which reconcileEventFolders handles via the diff.
    const legacyDeleted = isWrapped ? (body.deleted || []) : [];

    // Read-only demo (Vercel): skip all filesystem work and ack so the client
    // keeps its in-session state instead of surfacing a 500.
    if (PERSIST_DISABLED) {
      return NextResponse.json({ success: true, persisted: false });
    }

    let oldEvents: any[] = [];
    try {
      const data = await fs.readFile(filePath, "utf8");
      oldEvents = JSON.parse(data);
    } catch (e) {}

    // Fold any legacy `deleted` payload into the array as tombstones so a single
    // reconcile + write covers every case.
    const eventsToWrite = legacyDeleted.length
      ? [...newEvents, ...legacyDeleted.map((d: any) => ({ ...d, deletedAt: d.deletedAt || new Date().toISOString() }))]
      : newEvents;

    await reconcileEventFolders(oldEvents, eventsToWrite);
    await writeJsonAtomic(filePath, eventsToWrite);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
