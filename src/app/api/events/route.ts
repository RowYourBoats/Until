import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic, PERSIST_DISABLED } from "@/lib/atomicWrite";
import { rebaseExampleDates } from "@/lib/exampleData";

const filePath = path.join(process.cwd(), "data", "events.json");
const examplePath = path.join(process.cwd(), "data-example", "events.json");
const projectsRoot = path.join(process.cwd(), "projects");

async function ensureDirs() {
  // Active projects live directly in the root; archive states get _-prefixed dirs
  // so they sort out of the way in a file explorer / Google Drive.
  const dirs = [
    projectsRoot,
    path.join(projectsRoot, "_complete"),
    path.join(projectsRoot, "_incomplete"),
    path.join(projectsRoot, "_trash"),
  ];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Maps an event status to its containing directory. Active = root.
function statusDir(status: string | undefined) {
  switch (status) {
    case "completed":
      return path.join(projectsRoot, "_complete");
    case "incomplete":
      return path.join(projectsRoot, "_incomplete");
    default:
      return projectsRoot;
  }
}

function sanitizeFolderName(name: string) {
  // Strip leading underscores so an active project folder can never collide
  // with a reserved archive dir (_complete / _incomplete / _trash).
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .replace(/^_+/, '');
}

function getFolderName(event: any) {
  const name = sanitizeFolderName(event.name);
  const [year, month] = event.dueDate.split('-');
  // Format: name_MM_YYYY
  return `${name}_${month}_${year}`;
}

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
    const deletedEvents = isWrapped ? (body.deleted || []) : [];

    // Read-only demo (Vercel): skip all filesystem work and ack so the client
    // keeps its in-session state instead of surfacing a 500.
    if (PERSIST_DISABLED) {
      return NextResponse.json({ success: true, persisted: false });
    }

    await ensureDirs();

    let oldEvents = [];
    try {
      const data = await fs.readFile(filePath, "utf8");
      oldEvents = JSON.parse(data);
    } catch (e) {}

    // Track changes for folder management
    for (const newEvent of newEvents) {
      const oldEvent = oldEvents.find((e: any) => e.id === newEvent.id);
      const folderName = getFolderName(newEvent);
      
      if (!oldEvent) {
        // New event - create folder for its status (active lands in the root)
        const activePath = path.join(statusDir(newEvent.status), folderName);
        try {
          await fs.mkdir(activePath, { recursive: true });
        } catch (e) {
          console.error(`Failed to create folder: ${activePath}`, e);
        }
      } else if (oldEvent.status !== newEvent.status || oldEvent.dueDate !== newEvent.dueDate || oldEvent.name !== newEvent.name) {
        // Status, date, or name changed - potentially move/rename folder
        const oldFolderName = getFolderName(oldEvent);
        const oldPath = path.join(statusDir(oldEvent.status), oldFolderName);
        const newPath = path.join(statusDir(newEvent.status), folderName);
        
        if (oldPath !== newPath) {
          try {
            await fs.access(oldPath);
            await fs.rename(oldPath, newPath);
          } catch (e) {
            try {
              await fs.mkdir(newPath, { recursive: true });
            } catch (mkdirErr) {
              console.error(`Failed to move/create folder: ${newPath}`, mkdirErr);
            }
          }
        }
      }
    }

    // Handle deleted events - move folders to trash
    for (const deleted of deletedEvents) {
      const folderName = getFolderName(deleted);
      const oldPath = path.join(statusDir(deleted.status), folderName);
      const trashPath = path.join(projectsRoot, "_trash", folderName);
      try {
        await fs.access(oldPath);
        await fs.rename(oldPath, trashPath);
      } catch (e) {
        console.error(`Failed to move folder to trash: ${oldPath}`, e);
      }
    }

    await writeJsonAtomic(filePath, newEvents);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
