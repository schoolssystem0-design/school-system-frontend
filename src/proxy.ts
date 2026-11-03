import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decideRoute, platformHosts } from "@/lib/routing";

const PLATFORM = platformHosts();

export function proxy(request: NextRequest) {
  const decision = decideRoute({
    host: request.headers.get("host") ?? "",
    pathname: request.nextUrl.pathname,
    hasSession: request.cookies.has(SESSION_COOKIE),
    platform: PLATFORM,
  });

  switch (decision.kind) {
    case "rewrite": {
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return NextResponse.rewrite(url);
    }
    case "redirect": {
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      url.search = "";
      for (const [key, value] of Object.entries(decision.search ?? {})) {
        url.searchParams.set(key, value);
      }
      return NextResponse.redirect(url);
    }
    default:
      return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
