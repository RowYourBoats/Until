import { NextRequest, NextResponse } from "next/server";
import { COOKIE, clearRefreshCookie, googleToken, oauthConfig } from "@/lib/googleAuthServer";

export const dynamic = "force-dynamic";

/** Mint a fresh Drive access token from the refresh-token cookie — no popup. */
export async function GET(req: NextRequest) {
  const cfg = oauthConfig();
  if (!cfg) return NextResponse.json({ error: "server auth not configured" }, { status: 501 });
  const refreshToken = req.cookies.get(COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { ok, json } = await googleToken({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  if (!ok || !json.access_token) {
    const res = NextResponse.json({ error: json.error || "refresh failed" }, { status: 401 });
    // Revoked/expired grant: drop the cookie so the next Sync click re-consents.
    if (json.error === "invalid_grant") clearRefreshCookie(res);
    return res;
  }
  return NextResponse.json(
    { access_token: json.access_token, expires_in: json.expires_in },
    { headers: { "Cache-Control": "no-store" } },
  );
}
