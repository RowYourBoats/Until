import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { loadExampleFallback } from "@/lib/exampleData";

const filePath = path.join(process.cwd(), "data", "rhei.json");
const examplePath = path.join(process.cwd(), "data-example", "rhei.json");

export async function GET() {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(await loadExampleFallback(examplePath));
  }
}

export async function POST(request: Request) {
  try {
    const items = await request.json();
    await writeJsonAtomic(filePath, items);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rhei API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
