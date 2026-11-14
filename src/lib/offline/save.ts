import { browserOffline, isNetworkError, offlineQueue, type OfflineChange } from "./queue";

export type Saved<T> = { sent: true; result: T } | { sent: false; change: OfflineChange };

type Change = Omit<OfflineChange, "id" | "createdAt" | "state">;

/**
 * Sends a change now, or keeps it on this device when there is no internet (also when the request fails on the way).
 * The kept change is sent automatically later with exactly the same request.
 */
export async function saveOrQueue<T>(send: () => Promise<T>, change: Change): Promise<Saved<T>> {
  if (browserOffline()) return { sent: false, change: await offlineQueue.add(change) };
  try {
    const result = await send();
    // A register or mark sheet saved now replaces an older copy still waiting on this device
    if (change.method === "PUT") {
      const older = offlineQueue.find(change.path);
      if (older) await offlineQueue.discard(older.id);
    }
    return { sent: true, result };
  } catch (error) {
    if (isNetworkError(error)) return { sent: false, change: await offlineQueue.add(change) };
    throw error;
  }
}
