import { NextRequest, NextResponse } from "next/server";
import { STATE_COOKIE, googleToken, oauthConfig, requestOrigin, setRefreshCookie } from "@/lib/googleAuthServer";

export const dynamic = "force-dynamic";

/** Google redirects here with a code; swap it for a refresh token and go home. */
export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}/?${q}`);
    res.cookies.set(STATE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    return res;
  };

  const cfg = oauthConfig();
  if (!cfg) return back("authError=not_configured");

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  if (params.get("error")) return back(`authError=${encodeURIComponent(params.get("error")!)}`);
  if (!code || !state || state !== req.cookies.get(STATE_COOKIE)?.value) return back("authError=bad_state");

  const { ok, json } = await googleToken({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: `${origin}/api/auth/callback`,
    grant_type: "authorization_code",
  });
  if (!ok || !json.refresh_token) {
    return back(`authError=${encodeURIComponent(json.error || "no_refresh_token")}`);
  }

  const res = back("signedIn=1");
  setRefreshCookie(req, res, json.refresh_token);
  return res;
}
