/**
 * Server half of Drive sign-in: holds the Google refresh token in an httpOnly
 * cookie so a device signs in once and every later sync (hourly timer, reload,
 * PWA relaunch) gets a fresh access token without a popup. Needs the OAuth
 * client secret, which is why this lives server-side. Stateless — nothing is
 * written to disk, so it works on Vercel too.
 */

import type { NextRequest, NextResponse } from "next/server";

export const COOKIE = "until_grt";
export const STATE_COOKIE = "until_oauth_state";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const YEAR = 60 * 60 * 24 * 365;

/** Public origin of this request (honours Vercel / reverse-proxy headers). */
export function requestOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function oauthConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function googleToken(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export function setRefreshCookie(req: NextRequest, res: NextResponse, refreshToken: string) {
  res.cookies.set(COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: requestOrigin(req).startsWith("https:"),
    path: "/api/auth",
    maxAge: YEAR,
  });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/api/auth", maxAge: 0 });
}
