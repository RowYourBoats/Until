import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";

const filePath = path.join(process.cwd(), "data", "pomodoro-sessions.json");
const examplePath = path.join(process.cwd(), "data-example", "pomodoro-sessions.json");

export async function GET() {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    try {
      const data = await fs.readFile(examplePath, "utf8");
      return NextResponse.json(JSON.parse(data));
    } catch {
      return NextResponse.json([], { status: 200 });
    }
  }
}

export async function POST(request: Request) {
  try {
    const sessions = await request.json();
    await writeJsonAtomic(filePath, sessions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pomodoro sessions API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
