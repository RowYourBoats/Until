import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "daily-tasks.json");

export async function GET() {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const tasks = await request.json();
    await fs.writeFile(filePath, JSON.stringify(tasks, null, 2), "utf8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Daily tasks API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
