import type { components } from "./schema";

export type Schemas = components["schemas"];

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export type FieldError = { field: string; code: string; message: string };

/** A failed API call, parsed from the backend's RFC 9457 problem response (docs/API-CONVENTIONS.md). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfToken: string | null = null;

/** Academic year sent as X-Academic-Year (null = the school's current year). Set by the year switcher. */
let academicYearId: number | null = null;

export function setAcademicYear(id: number | null) {
  academicYearId = id;
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) throw await toApiError(response);
  const body = (await response.json()) as Schemas["CsrfResponse"];
  csrfToken = body.token ?? null;
  if (!csrfToken) throw new ApiError(500, "CSRF_MISSING", "No CSRF token");
  return csrfToken;
}

/** Forget the cached CSRF token (the server clears it on sign-out). */
export function resetCsrfToken() {
  csrfToken = null;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const problem = (await response.json()) as {
      code?: string;
      detail?: string;
      requestId?: string;
      errors?: FieldError[];
    };
    return new ApiError(
      response.status,
      problem.code ?? `HTTP_${response.status}`,
      problem.detail ?? response.statusText,
      problem.requestId,
      problem.errors ?? [],
    );
  } catch {
    return new ApiError(response.status, `HTTP_${response.status}`, response.statusText);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** multipart upload (FormData); sent without a JSON content type */
  form?: FormData;
  /** extra headers, e.g. Idempotency-Key on money-creating calls */
  headers?: Record<string, string>;
};

async function send(
  path: string,
  { method = "GET", body, form, headers: extra }: RequestOptions,
  accept: string,
): Promise<Response> {
  const attempt = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: accept, ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["X-XSRF-TOKEN"] = token;
    if (academicYearId != null) headers["X-Academic-Year"] = String(academicYearId);
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  };

  const unsafe = UNSAFE_METHODS.has(method);
  let response = await attempt(unsafe ? (csrfToken ?? (await fetchCsrfToken())) : null);
  if (unsafe && response.status === 403) {
    const error = await toApiError(response.clone());
    // Only a CSRF rejection is retried; real permission errors are returned as they are.
    if (error.code === "FORBIDDEN") {
      response = await attempt(await fetchCsrfToken());
    }
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

/**
 * Calls the API with the session cookie. State-changing requests carry the CSRF token; if the server rejects it
 * (e.g. after sign-out or a session change), the token is refreshed once and the request retried.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options, "application/json");
  if (response.status === 204 || response.status === 202) return undefined as T;
  return (await response.json()) as T;
}

/** Calls an endpoint that returns a file (PDF certificates, forms, ID cards; a PNG datesheet). */
export async function apiBlob(path: string, options: RequestOptions = {}, type = "application/pdf"): Promise<Blob> {
  // Errors still come back as problem+json, so they must stay acceptable.
  const response = await send(path, options, `${type}, application/problem+json, application/json`);
  return response.blob();
}

/**
 * Saves a downloaded PDF. A download link is used rather than a new tab because browsers block pop-ups opened after
 * the request finishes.
 */
export function openBlob(blob: Blob, fileName = "document.pdf") {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** URL of a stored file (logo, stamp…) for <img src>; the browser sends the session cookie. */
export function fileUrl(fileId: number | null | undefined) {
  return fileId == null ? null : `${API_BASE_URL}/files/${fileId}`;
}

/** Turns any error into a short English message for toasts and alerts. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) return error.fieldErrors.map((f) => f.message).join(". ");
    return error.message;
  }
  return "Cannot reach the server. Check your connection and try again.";
}
