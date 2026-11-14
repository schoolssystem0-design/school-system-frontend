/**
 * While online, quietly loads what the day's work needs if the internet drops: today's registers, recent tests with
 * their mark sheets, and the fee counter's snapshot. Each part only for people who may do that work. The data lands
 * in the normal query cache (saved on the device by persist.ts) under the keys the screens use.
 */
import type { QueryClient } from "@tanstack/react-query";
import { api, type Schemas } from "@/lib/api/client";
import { attendance } from "@/lib/api/attendance";
import { academics } from "@/lib/api/endpoints";
import { testMarks } from "@/lib/api/test-marks";
import { browserOffline } from "./queue";

const MAX_SECTIONS = 40;
const MAX_SHEETS = 40;
const RECENT_TEST_DAYS = 14;

export function todayInSchool() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

/** Runs tasks a few at a time; a failed one is skipped. */
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<unknown>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift() as T;
        await work(item).catch(() => undefined);
      }
    }),
  );
}

/** Pages to keep for opening offline (the service worker stores their HTML). */
function cachePages(urls: string[]) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "cache-pages", urls });
}

export async function prepareForOffline(client: QueryClient, permissions: string[]) {
  if (browserOffline()) return;
  const can = (p: string) => permissions.includes(p);
  const pages = ["/app"];
  const classes = await client.fetchQuery({ queryKey: ["academics", "classes"], queryFn: academics.classes, staleTime: 60_000 });
  const sections = (classes ?? [])
    .filter((c) => c.status === "ACTIVE")
    .flatMap((c) => (c.sections ?? []).filter((s) => s.status === "ACTIVE").map((s) => s.id ?? 0))
    .slice(0, MAX_SECTIONS);
  const day = todayInSchool();

  if (can("attendance.mark") || can("attendance.view")) {
    pages.push("/app/attendance");
    await pool(sections, 4, (id) =>
      client.prefetchQuery({ queryKey: ["attendance", "register", id, day], queryFn: () => attendance.register(id, day), staleTime: 60_000 }),
    );
  }

  if (can("exams.marks.enter")) {
    pages.push("/app/marks");
    const from = new Date(Date.now() - RECENT_TEST_DAYS * 86_400_000).toISOString().slice(0, 10);
    const recent: number[] = [];
    await pool(sections, 4, async (id) => {
      const tests = await client.fetchQuery({ queryKey: ["test-marks", "list", id], queryFn: () => testMarks.list(id), staleTime: 60_000 });
      tests.filter((t) => (t.testDate ?? "") >= from).forEach((t) => recent.push(t.id ?? 0));
    });
    const sheets = recent.slice(0, MAX_SHEETS);
    await pool(sheets, 4, (id) =>
      client.prefetchQuery({ queryKey: ["test-marks", "sheet", id], queryFn: () => testMarks.sheet(id), staleTime: 60_000 }),
    );
    pages.push("/app/marks/test");
  }

  if (can("admissions.enrol")) {
    pages.push("/app/students/new");
    await client
      .prefetchQuery({
        queryKey: ["families", "offline-list"],
        queryFn: () => api<Schemas["FamilyRow"][]>("/families/offline-list"),
        staleTime: 60_000,
      })
      .catch(() => undefined);
  }

  if (can("fees.payment.add")) {
    pages.push("/app/fees/collect");
    await client
      .prefetchQuery({
        queryKey: ["fees", "offline-snapshot"],
        queryFn: () => api<Schemas["FeeSnapshot"]>("/fees/offline-snapshot"),
        staleTime: 60_000,
      })
      .catch(() => undefined);
    await client
      .prefetchQuery({ queryKey: ["fees", "accounts"], queryFn: () => api<Schemas["AccountView"][]>("/fees/accounts") })
      .catch(() => undefined);
  }
  cachePages(pages);
}
