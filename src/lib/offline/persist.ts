/**
 * Keeps the data needed to work offline (who is signed in, years, classes, today's registers, recent tests and mark
 * sheets, the fee counter's snapshot) on this device, so the screens open even after a reload with no internet.
 * Only these queries are saved; anything older than a day is ignored; signing out removes it.
 */
import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { offlineDb } from "./idb";

const KEY = "query-cache";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Query keys (by their first parts) worth keeping on the device. */
const KEPT: readonly (readonly unknown[])[] = [
  ["auth", "me"],
  ["school"],
  ["academics", "classes"],
  ["attendance", "register"],
  ["test-marks", "list"],
  ["test-marks", "sheet"],
  ["fees", "offline-snapshot"],
  ["fees", "accounts"],
  ["families", "offline-list"],
];

function kept(query: Query) {
  return (
    query.state.status === "success" &&
    KEPT.some((prefix) => prefix.every((part, i) => query.queryKey[i] === part))
  );
}

type Saved = { savedAt: number; state: ReturnType<typeof dehydrate> };

/** Puts the saved data back into the cache (before the screens ask for it). */
export async function restoreCache(client: QueryClient) {
  const saved = await offlineDb.get<Saved>(KEY);
  if (!saved || Date.now() - saved.savedAt > MAX_AGE_MS) return;
  try {
    hydrate(client, saved.state);
  } catch {
    // An old format: ignore it
  }
}

/** Saves the kept queries whenever they change (at most every 2 seconds). Returns a stop function. */
export function keepCacheSaved(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    const state = dehydrate(client, { shouldDehydrateQuery: kept });
    void offlineDb.set(KEY, { savedAt: Date.now(), state } satisfies Saved);
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" && event.type !== "removed") return;
    if (event.type === "updated" && !kept(event.query)) return;
    timer ??= setTimeout(save, 2000);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

export async function clearSavedCache() {
  await offlineDb.remove(KEY);
}
