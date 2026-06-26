import fs from "fs/promises";
import path from "path";

/**
 * Project-folder reconciliation for events. Each event mirrors to a real folder
 * on disk (the Drive workflow): active events live in projects/, archived states
 * in _-prefixed dirs, deletions in _trash. Both the events POST and the sync
 * merge call reconcileEventFolders so the folders track the data the same way.
 */

const projectsRoot = path.join(process.cwd(), "projects");

export async function ensureDirs() {
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
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .replace(/^_+/, "");
}

function getFolderName(event: any) {
  const name = sanitizeFolderName(event.name);
  const [year, month] = event.dueDate.split("-");
  return `${name}_${month}_${year}`;
}

/**
 * Diff old vs new event arrays (both may contain soft-delete tombstones) and move
 * folders to match: create for new/restored events, rename on status/date/name
 * change, move to _trash when an event becomes newly tombstoned. Folder errors are
 * logged, never thrown — folder drift must not fail a data write.
 */
export async function reconcileEventFolders(oldEvents: any[], newEvents: any[]) {
  await ensureDirs();
  const oldById = new Map<string, any>(oldEvents.map((e) => [e.id, e]));

  for (const newEvent of newEvents) {
    const oldEvent = oldById.get(newEvent.id);
    const folderName = getFolderName(newEvent);

    // Newly tombstoned -> move its folder to _trash.
    if (newEvent.deletedAt && (!oldEvent || !oldEvent.deletedAt)) {
      const oldPath = path.join(statusDir(oldEvent?.status ?? newEvent.status), getFolderName(oldEvent ?? newEvent));
      const trashPath = path.join(projectsRoot, "_trash", folderName);
      try {
        await fs.access(oldPath);
        await fs.rename(oldPath, trashPath);
      } catch (e) {
        console.error(`Failed to move folder to trash: ${oldPath}`, e);
      }
      continue;
    }

    if (newEvent.deletedAt) continue; // already a tombstone — nothing to do

    if (!oldEvent || oldEvent.deletedAt) {
      // New event, or restored from a tombstone — (re)create its folder.
      const activePath = path.join(statusDir(newEvent.status), folderName);
      try {
        await fs.mkdir(activePath, { recursive: true });
      } catch (e) {
        console.error(`Failed to create folder: ${activePath}`, e);
      }
    } else if (
      oldEvent.status !== newEvent.status ||
      oldEvent.dueDate !== newEvent.dueDate ||
      oldEvent.name !== newEvent.name
    ) {
      const oldPath = path.join(statusDir(oldEvent.status), getFolderName(oldEvent));
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
}
