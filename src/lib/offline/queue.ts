/**
 * Changes made while the internet is down (attendance registers, test marks, fee payments), kept on this device and
 * sent to the server, in the order they were made, as soon as the connection is back.
 *
 * - The queue belongs to one signed-in user of one school; another user on the same device never sees or sends it.
 * - Each change is a normal API call replayed later. Registers and marks are saved whole (PUT), so sending one twice is
 *   harmless; a payment carries its own Idempotency-Key, so it can never be recorded twice.
 * - A change the server refuses (e.g. the register was closed meanwhile) is kept as "needs attention" with the
 *   server's reason; nothing is ever dropped silently.
 */
import { api, ApiError } from "@/lib/api/client";
import { offlineDb } from "./idb";

export type ChangeKind = "attendance" | "marks" | "payment" | "admission";

export type OfflineChange = {
  id: string;
  kind: ChangeKind;
  /** What the person sees, e.g. "Attendance · Class 5 - A · 14 Nov" */
  label: string;
  method: "PUT" | "POST";
  path: string;
  body: unknown;
  idempotencyKey?: string;
  createdAt: string;
  state: "waiting" | "failed";
  error?: string;
  /** Free details for the screens, e.g. sectionId and date of a register */
  meta?: Record<string, unknown>;
};

export type SyncState = {
  owner: string | null;
  changes: OfflineChange[];
  syncing: boolean;
  /** The session ended while offline: the changes wait until the same person signs in again. */
  needsSignIn: boolean;
  lastSyncedAt: string | null;
};

type Listener = () => void;

let state: SyncState = { owner: null, changes: [], syncing: false, needsSignIn: false, lastSyncedAt: null };
const listeners = new Set<Listener>();
const sentListeners = new Set<(change: OfflineChange, result: unknown) => void>();

const keyOf = (owner: string) => `queue:${owner}`;

function publish(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

async function persist() {
  if (state.owner) await offlineDb.set(keyOf(state.owner), state.changes);
}

/** Network trouble (no internet, server unreachable), as opposed to an answer from the server. */
export function isNetworkError(error: unknown) {
  return !(error instanceof ApiError);
}

/** True when the browser knows it has no network at all (Wi-Fi with no internet still says true). */
export function browserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Brothers and sisters admitted offline into the same new family: the first admission creates the family; the ones
 * after it (marked meta.familyFrom = first change id) then join that family instead of creating another.
 */
function linkFamily(changes: OfflineChange[], sent: OfflineChange, result: unknown) {
  const familyId = (result as { family?: { id?: number } } | null)?.family?.id;
  if (sent.kind !== "admission" || familyId == null) return changes;
  return changes.map((c) => {
    if (c.meta?.familyFrom !== sent.id || c.state !== "waiting") return c;
    const { newFamily: _dropped, ...body } = c.body as Record<string, unknown>; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { ...c, body: { ...body, familyId }, meta: { ...c.meta, familyFrom: undefined } };
  });
}

export const offlineQueue = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => state,

  /** Called after each change reaches the server, e.g. to refresh the screens that show it. */
  onSent(listener: (change: OfflineChange, result: unknown) => void) {
    sentListeners.add(listener);
    return () => sentListeners.delete(listener);
  },

  /** Loads this user's queue (school id + user id); called when the signed-in user is known. */
  async setOwner(owner: string | null) {
    if (owner === state.owner) return;
    const changes = owner ? ((await offlineDb.get<OfflineChange[]>(keyOf(owner))) ?? []) : [];
    publish({ owner, changes, needsSignIn: false });
  },

  async add(change: Omit<OfflineChange, "id" | "createdAt" | "state">) {
    if (!state.owner) throw new Error("Not signed in");
    const full: OfflineChange = { ...change, id: crypto.randomUUID(), createdAt: new Date().toISOString(), state: "waiting" };
    // A newer copy of the same register or mark sheet replaces the waiting one (it is saved whole anyway).
    const others = state.changes.filter((c) => !(c.state === "waiting" && c.method === "PUT" && c.path === full.path));
    publish({ changes: [...others, full] });
    await persist();
    return full;
  },

  async discard(id: string) {
    publish({ changes: state.changes.filter((c) => c.id !== id) });
    await persist();
  },

  /** Puts a refused change back in line (e.g. after the reason for it was fixed on the server). */
  async retry(id: string) {
    publish({ changes: state.changes.map((c) => (c.id === id ? { ...c, state: "waiting", error: undefined } : c)) });
    await persist();
    void offlineQueue.sync();
  },

  /** The waiting change for a resource (a register or mark sheet), if any. */
  find: (path: string) => state.changes.find((c) => c.path === path && c.state === "waiting"),

  /** Sends waiting changes in order. Stops at the first network problem (still offline) or an ended session. */
  async sync() {
    if (state.syncing || !state.owner || browserOffline()) return;
    const waiting = state.changes.filter((c) => c.state === "waiting");
    if (waiting.length === 0) return;
    publish({ syncing: true });
    try {
      for (const queued of waiting) {
        // The latest version: an earlier change in this run may have updated it (e.g. a brother joining the family
        // his sister's admission just created)
        const change = state.changes.find((c) => c.id === queued.id);
        if (!change || change.state !== "waiting") continue;
        try {
          const result = await api<unknown>(change.path, {
            method: change.method,
            body: change.body,
            headers: change.idempotencyKey ? { "Idempotency-Key": change.idempotencyKey } : undefined,
          });
          publish({ changes: linkFamily(state.changes.filter((c) => c.id !== change.id), change, result), needsSignIn: false });
          await persist();
          sentListeners.forEach((l) => l(change, result));
        } catch (error) {
          if (isNetworkError(error)) break; // still offline: try again later
          const e = error as ApiError;
          if (e.status === 401) {
            publish({ needsSignIn: true });
            break;
          }
          if (e.status >= 500 || e.status === 429) {
            break; // the server is having trouble: try again later
          }
          publish({
            changes: state.changes.map((c) => (c.id === change.id ? { ...c, state: "failed", error: e.message } : c)),
          });
          await persist();
        }
      }
      publish({ lastSyncedAt: new Date().toISOString() });
    } finally {
      publish({ syncing: false });
    }
  },

  /** Signing out: forget this device's data for the user (the caller warns first if changes are waiting). */
  async clear() {
    if (state.owner) await offlineDb.remove(keyOf(state.owner));
    publish({ owner: null, changes: [], needsSignIn: false });
  },
};
