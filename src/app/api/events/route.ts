import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "events.json");
const projectsRoot = path.join(process.cwd(), "projects");

async function ensureDirs() {
  const dirs = [
    projectsRoot,
    path.join(projectsRoot, "active"),
    path.join(projectsRoot, "completed"),
    path.join(projectsRoot, "incomplete"),
    path.join(projectsRoot, "trash"),
  ];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

function sanitizeFolderName(name: string) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
  } catch (error) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDirs();
    const body = await request.json();
    const isWrapped = body && !Array.isArray(body) && body.events;
    const newEvents = isWrapped ? body.events : body;
    const deletedEvents = isWrapped ? (body.deleted || []) : [];

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
        // New event - create folder in active
        const activePath = path.join(projectsRoot, "active", folderName);
        try {
          await fs.mkdir(activePath, { recursive: true });
        } catch (e) {
          console.error(`Failed to create folder: ${activePath}`, e);
        }
      } else if (oldEvent.status !== newEvent.status || oldEvent.dueDate !== newEvent.dueDate || oldEvent.name !== newEvent.name) {
        // Status, date, or name changed - potentially move/rename folder
        const oldStatus = oldEvent.status || 'active';
        const newStatus = newEvent.status || 'active';
        const oldFolderName = getFolderName(oldEvent);
        const oldPath = path.join(projectsRoot, oldStatus, oldFolderName);
        const newPath = path.join(projectsRoot, newStatus, folderName);
        
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
      const status = deleted.status || 'active';
      const folderName = getFolderName(deleted);
      const oldPath = path.join(projectsRoot, status, folderName);
      const trashPath = path.join(projectsRoot, "trash", folderName);
      try {
        await fs.access(oldPath);
        await fs.rename(oldPath, trashPath);
      } catch (e) {
        console.error(`Failed to move folder to trash: ${oldPath}`, e);
      }
    }

    await fs.writeFile(filePath, JSON.stringify(newEvents, null, 2), "utf8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
