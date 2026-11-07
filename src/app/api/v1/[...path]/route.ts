import { type NextRequest } from "next/server";

/** Railway (or local) API origin without a trailing slash. Set on Vercel when using *.vercel.app + *.railway.app. */
function backendOrigin(): string | null {
  const raw = process.env.API_PROXY_TARGET?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, "");
}

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "cookie",
  "x-xsrf-token",
  "x-academic-year",
  "idempotency-key",
  "x-request-id",
  "x-step-up-token",
];

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const origin = backendOrigin();
  if (!origin) {
    return Response.json(
      { detail: "API proxy is not configured (set API_PROXY_TARGET on the frontend host)." },
      { status: 503 },
    );
  }

  const suffix = path.join("/");
  const target = `${origin}/api/v1/${suffix}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };
  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    responseHeaders.set(key, value);
  });
  // Multiple Set-Cookie values must be forwarded separately; copying Headers merges them and breaks sessions.
  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookies.length === 0) {
    const single = upstream.headers.get("set-cookie");
    if (single) {
      setCookies.push(single);
    }
  }
  for (const cookie of setCookies) {
    responseHeaders.append("Set-Cookie", cookie);
  }
  responseHeaders.delete("connection");
  responseHeaders.delete("keep-alive");
  responseHeaders.delete("transfer-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
