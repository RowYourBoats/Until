"use client";

import { useEffect } from "react";

/**
 * Registers the offline app-shell service worker. `navigator.serviceWorker` only
 * exists in a secure context (HTTPS or localhost), so over plain-http LAN this is a
 * no-op — the app still works, just without offline launch until served over HTTPS.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
