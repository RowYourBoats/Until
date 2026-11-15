import { NextRequest, NextResponse } from "next/server";
import { STATE_COOKIE, oauthConfig, requestOrigin } from "@/lib/googleAuthServer";

export const dynamic = "force-dynamic";

/**
 * Start sign-in: a full-page redirect to Google (no popup, so it works from the
 * hourly-sync context and inside an iOS home-screen app). `access_type=offline`
 * + `prompt=consent` guarantee a refresh token for this device.
 */
export async function GET(req: NextRequest) {
  const cfg = oauthConfig();
  if (!cfg) return NextResponse.json({ error: "server auth not configured" }, { status: 501 });

  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${requestOrigin(req)}/api/auth/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: requestOrigin(req).startsWith("https:"),
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}
