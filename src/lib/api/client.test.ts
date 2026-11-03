import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiBlob, resetCsrfToken } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends cookies and no CSRF header on GET", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await api("/auth/me");
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.credentials).toBe("include");
    expect((init?.headers as Record<string, string>)["X-XSRF-TOKEN"]).toBeUndefined();
  });

  it("fetches a CSRF token before the first POST and sends it", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { headerName: "X-XSRF-TOKEN", token: "t1" }))
      .mockResolvedValueOnce(json(200, { userId: 1 }));
    await api("/auth/login", { method: "POST", body: { a: 1 } });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/csrf$/);
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers["X-XSRF-TOKEN"]).toBe("t1");
  });

  it("refreshes the CSRF token once when the server rejects it", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { token: "old" }))
      .mockResolvedValueOnce(json(403, { code: "FORBIDDEN" }))
      .mockResolvedValueOnce(json(200, { token: "new" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api("/auth/logout", { method: "POST" });
    const retried = fetchMock.mock.calls[3][1]?.headers as Record<string, string>;
    expect(retried["X-XSRF-TOKEN"]).toBe("new");
  });

  it("turns problem responses into ApiError with code and request ID", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        code: "VALIDATION_FAILED",
        detail: "One or more fields are invalid",
        requestId: "req-123",
        errors: [{ field: "username", code: "NOTBLANK", message: "must not be blank" }],
      }),
    );
    const error = (await api("/students").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "VALIDATION_FAILED", requestId: "req-123" });
    expect(error.fieldErrors).toHaveLength(1);
  });

  it("downloads files as blobs and still accepts problem responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response("%PDF", { status: 200, headers: { "Content-Type": "application/pdf" } }));
    const blob = await apiBlob("/students/1/bio-data");
    expect(await blob.text()).toBe("%PDF");
    const accept = (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Accept;
    expect(accept).toContain("application/pdf");
    expect(accept).toContain("application/problem+json");
  });

  it("raises ApiError when a file download fails", async () => {
    fetchMock.mockResolvedValueOnce(json(422, { code: "NOT_LEFT", detail: "Record the withdrawal first" }));
    const error = (await apiBlob("/students/1/certificates/LEAVING").catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 422, code: "NOT_LEFT" });
  });
});
