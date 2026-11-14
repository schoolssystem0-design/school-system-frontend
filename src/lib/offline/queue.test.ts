import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const api = vi.fn();
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { offlineQueue } = await import("./queue");
const { saveOrQueue } = await import("./save");

const register = (date: string, status = "A") => ({
  kind: "attendance" as const,
  label: `Attendance ${date}`,
  method: "PUT" as const,
  path: `/attendance/registers/5?date=${date}`,
  body: { marks: [{ studentId: 1, status }] },
});

describe("offline queue", () => {
  beforeEach(async () => {
    api.mockReset();
    await offlineQueue.clear();
    await offlineQueue.setOwner("1:7");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("keeps one copy of a register: a newer save replaces the waiting one", async () => {
    await offlineQueue.add(register("2026-11-14", "A"));
    await offlineQueue.add(register("2026-11-14", "P"));
    await offlineQueue.add(register("2026-11-13"));
    const changes = offlineQueue.snapshot().changes;
    expect(changes).toHaveLength(2);
    expect(changes[0].body).toEqual({ marks: [{ studentId: 1, status: "P" }] });
  });

  it("sends in order and removes what reached the server", async () => {
    await offlineQueue.add(register("2026-11-13"));
    await offlineQueue.add({ ...register("2026-11-14"), kind: "payment", method: "POST", path: "/fees/payments", idempotencyKey: "k-1" });
    api.mockResolvedValue({});
    await offlineQueue.sync();
    expect(api.mock.calls.map((c) => c[0])).toEqual(["/attendance/registers/5?date=2026-11-13", "/fees/payments"]);
    // The payment is replayed with its own key, so the server can never record it twice
    expect(api.mock.calls[1][1].headers).toEqual({ "Idempotency-Key": "k-1" });
    expect(offlineQueue.snapshot().changes).toHaveLength(0);
  });

  it("stops at a network failure and keeps everything for later", async () => {
    await offlineQueue.add(register("2026-11-13"));
    await offlineQueue.add(register("2026-11-14"));
    api.mockRejectedValue(new TypeError("Failed to fetch"));
    await offlineQueue.sync();
    expect(api).toHaveBeenCalledTimes(1);
    expect(offlineQueue.snapshot().changes.map((c) => c.state)).toEqual(["waiting", "waiting"]);
  });

  it("sets aside a change the server refuses and carries on with the rest", async () => {
    await offlineQueue.add(register("2026-11-13"));
    await offlineQueue.add(register("2026-11-14"));
    api.mockRejectedValueOnce(new ApiError(422, "REASON_REQUIRED", "Give a reason for changing an earlier day")).mockResolvedValueOnce({});
    await offlineQueue.sync();
    const [refused, ...rest] = offlineQueue.snapshot().changes;
    expect(rest).toHaveLength(0);
    expect(refused.state).toBe("failed");
    expect(refused.error).toBe("Give a reason for changing an earlier day");
  });

  it("waits for the same person to sign in again when the session ended", async () => {
    await offlineQueue.add(register("2026-11-14"));
    api.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sign in to continue"));
    await offlineQueue.sync();
    expect(offlineQueue.snapshot().needsSignIn).toBe(true);
    expect(offlineQueue.snapshot().changes[0].state).toBe("waiting");
  });

  it("does not try to send while the device has no network", async () => {
    await offlineQueue.add(register("2026-11-14"));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await offlineQueue.sync();
    expect(api).not.toHaveBeenCalled();
  });

  it("a brother admitted offline joins the new family his sister's admission created", async () => {
    const newFamily = { fatherName: "Ali Raza", fatherPhone: "0300-1234567" };
    const sister = await offlineQueue.add({
      kind: "admission", label: "Admission · Sara", method: "POST", path: "/students", idempotencyKey: "a-1",
      body: { student: { name: "Sara" }, sectionId: 5, newFamily },
    });
    await offlineQueue.add({
      kind: "admission", label: "Admission · Ahmed", method: "POST", path: "/students", idempotencyKey: "a-2",
      body: { student: { name: "Ahmed" }, sectionId: 5, newFamily }, meta: { familyFrom: sister.id },
    });
    api.mockResolvedValueOnce({ id: 31, grNo: "031", family: { id: 77 } }).mockResolvedValueOnce({ id: 32, grNo: "032" });
    await offlineQueue.sync();
    expect(api).toHaveBeenCalledTimes(2);
    const brother = api.mock.calls[1][1];
    expect(brother.body).toEqual({ student: { name: "Ahmed" }, sectionId: 5, familyId: 77 });
    expect(brother.headers).toEqual({ "Idempotency-Key": "a-2" });
    expect(offlineQueue.snapshot().changes).toHaveLength(0);
  });

  it("another user on the same device has their own queue", async () => {
    await offlineQueue.add(register("2026-11-14"));
    await offlineQueue.setOwner("1:8");
    expect(offlineQueue.snapshot().changes).toHaveLength(0);
  });
});

describe("saveOrQueue", () => {
  beforeEach(async () => {
    api.mockReset();
    await offlineQueue.clear();
    await offlineQueue.setOwner("1:7");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("keeps the change when the request fails on the way", async () => {
    const saved = await saveOrQueue(() => Promise.reject(new TypeError("Failed to fetch")), register("2026-11-14"));
    expect(saved.sent).toBe(false);
    expect(offlineQueue.snapshot().changes).toHaveLength(1);
  });

  it("an online save replaces an older copy still waiting", async () => {
    await offlineQueue.add(register("2026-11-14", "A"));
    const saved = await saveOrQueue(() => Promise.resolve({ ok: true }), register("2026-11-14", "P"));
    expect(saved.sent).toBe(true);
    expect(offlineQueue.snapshot().changes).toHaveLength(0);
  });

  it("passes the server's refusal to the screen (nothing is queued)", async () => {
    await expect(
      saveOrQueue(() => Promise.reject(new ApiError(403, "FORBIDDEN", "No")), register("2026-11-14")),
    ).rejects.toBeInstanceOf(ApiError);
    expect(offlineQueue.snapshot().changes).toHaveLength(0);
  });
});
