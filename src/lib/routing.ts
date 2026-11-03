/**
 * Decides what the proxy does with a request (docs/ARCHITECTURE.md §1):
 * - the platform app host serves the school portal (/app), sign-in and the super admin console;
 * - any other host is a school's public website, rewritten to /site/<host>/...
 */
export type RouteDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; pathname: string; search?: Record<string, string> };

export const SESSION_COOKIE = "SMS_SESSION";

export function platformHosts(value = process.env.PLATFORM_APP_HOSTS) {
  return (value ?? "localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function stripPort(host: string) {
  return host.replace(/:\d+$/, "").toLowerCase();
}

export function decideRoute(input: {
  host: string;
  pathname: string;
  hasSession: boolean;
  platform: string[];
}): RouteDecision {
  const host = stripPort(input.host);
  const { pathname } = input;

  if (!input.platform.includes(host)) {
    return { kind: "rewrite", pathname: `/site/${host}${pathname === "/" ? "" : pathname}` };
  }

  // Website pages are only reachable through their own host.
  if (pathname === "/site" || pathname.startsWith("/site/")) {
    return { kind: "redirect", pathname: "/" };
  }

  // Shortcut link for a school: /s/<code> pre-fills the school code on sign-in.
  const shortcut = pathname.match(/^\/s\/([A-Za-z0-9-]{2,20})\/?$/);
  if (shortcut) {
    return { kind: "redirect", pathname: "/sign-in", search: { school: shortcut[1].toUpperCase() } };
  }

  // Cosmetic only: the API is the real access check.
  if ((pathname === "/app" || pathname.startsWith("/app/")) && !input.hasSession) {
    return { kind: "redirect", pathname: "/sign-in", search: { next: pathname } };
  }
  const platformPage = pathname === "/platform" || pathname.startsWith("/platform/");
  if (platformPage && pathname !== "/platform/sign-in" && !input.hasSession) {
    return { kind: "redirect", pathname: "/platform/sign-in" };
  }

  return { kind: "next" };
}
