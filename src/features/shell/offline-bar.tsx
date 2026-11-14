"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useOffline } from "next/offline";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Me } from "@/lib/api/auth";
import { formatDateTime } from "@/lib/format";
import { prepareForOffline } from "@/lib/offline/prepare";
import { browserOffline, offlineQueue, type OfflineChange } from "@/lib/offline/queue";

const PREPARE_EVERY_MS = 15 * 60 * 1000;
const SYNC_EVERY_MS = 20 * 1000;

function subscribeNetwork(change: () => void) {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => {
    window.removeEventListener("online", change);
    window.removeEventListener("offline", change);
  };
}

/** No internet: the device has no network, or a page request could not reach the server (Wi-Fi without internet). */
export function useNoInternet() {
  const failed = useOffline();
  const noNetwork = useSyncExternalStore(subscribeNetwork, () => !navigator.onLine, () => false);
  return failed || noNetwork;
}

export function useSyncState() {
  return useSyncExternalStore(offlineQueue.subscribe, offlineQueue.snapshot, offlineQueue.snapshot);
}

/** Runs the offline machinery for the signed-in user: their queue, sending it when online, and preparing data. */
export function useOfflineSync(me: Me) {
  const queryClient = useQueryClient();
  const owner = me.school?.id != null ? `${me.school.id}:${me.userId}` : null;
  const permissions = me.permissions;

  useEffect(() => {
    void offlineQueue.setOwner(owner).then(() => offlineQueue.sync());
  }, [owner]);

  useEffect(() => {
    const sync = () => void offlineQueue.sync();
    window.addEventListener("online", sync);
    const timer = setInterval(sync, SYNC_EVERY_MS);
    const stop = offlineQueue.onSent((change, result) => {
      const keys: Record<OfflineChange["kind"], unknown[][]> = {
        attendance: [["attendance"]],
        marks: [["test-marks"]],
        payment: [["fees"]],
        admission: [["students"], ["families"]],
      };
      keys[change.kind].forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
      const admitted = change.kind === "admission" ? (result as { grNo?: string; details?: { name?: string } }) : null;
      toast.success(admitted ? `Admitted ${admitted.details?.name} with GR no. ${admitted.grNo}` : `Sent: ${change.label}`);
    });
    return () => {
      window.removeEventListener("online", sync);
      clearInterval(timer);
      stop();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!owner) return;
    const prepare = () => {
      if (document.visibilityState === "visible" && !browserOffline()) {
        void prepareForOffline(queryClient, permissions ?? []).catch(() => undefined);
      }
    };
    const first = setTimeout(prepare, 3000);
    const timer = setInterval(prepare, PREPARE_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [owner, permissions, queryClient]);
}

/** A small always-visible sign in the header (the strip above can scroll out of view on long pages). */
export function OfflinePill() {
  const offline = useNoInternet();
  const sync = useSyncState();
  const waiting = sync.changes.filter((c) => c.state === "waiting").length;
  const failed = sync.changes.filter((c) => c.state === "failed").length;
  if (!offline && waiting === 0 && failed === 0) return null;
  const text = failed > 0 ? `${failed} not saved` : sync.syncing ? "Sending…" : offline ? (waiting ? `Offline · ${waiting} waiting` : "Offline") : `${waiting} waiting`;
  return (
    <span
      role="status"
      title={offline ? "No internet: changes are saved on this device" : "Changes made offline"}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${failed > 0 ? "bg-destructive/10 text-destructive" : offline ? "bg-navy text-white" : "bg-primary/10 text-primary"}`}
    >
      {sync.syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
      {text}
    </span>
  );
}

/** The strip under the header: offline, changes waiting, sending, or changes that need attention. */
export function OfflineBar() {
  const offline = useNoInternet();
  const sync = useSyncState();
  const [reviewing, setReviewing] = useState(false);
  const waiting = sync.changes.filter((c) => c.state === "waiting");
  const failed = sync.changes.filter((c) => c.state === "failed");
  const plural = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

  let content: React.ReactNode = null;
  let tone = "bg-muted text-foreground";
  if (failed.length > 0) {
    tone = "bg-destructive/10 text-destructive";
    content = (
      <>
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span>{plural(failed.length)} made offline could not be saved.</span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setReviewing(true)}>
          Review
        </Button>
      </>
    );
  } else if (sync.needsSignIn && waiting.length > 0) {
    tone = "bg-highlight/15 text-foreground";
    content = (
      <>
        <AlertTriangle className="size-4 shrink-0 text-highlight-ink" aria-hidden />
        <span>Your session ended. Sign in again to send {plural(waiting.length)} saved on this device.</span>
        <Button size="sm" variant="outline" className="h-7" render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </>
    );
  } else if (sync.syncing && waiting.length > 0) {
    tone = "bg-primary/10 text-foreground";
    content = (
      <>
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <span>Sending {plural(waiting.length)} made offline…</span>
      </>
    );
  } else if (offline || waiting.length > 0) {
    tone = "bg-navy text-white";
    content = (
      <>
        <CloudOff className="size-4 shrink-0" aria-hidden />
        <span>
          {offline ? "No internet. " : "Waiting for the connection. "}
          {waiting.length > 0
            ? `${plural(waiting.length)} saved on this device, sent automatically when the internet is back.`
            : "Attendance, test marks and fee collection keep working; changes are saved on this device."}
        </span>
        {!offline && waiting.length > 0 && (
          <Button size="sm" variant="secondary" className="h-7" onClick={() => void offlineQueue.sync()}>
            <RefreshCw aria-hidden /> Send now
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {content && (
        <div role="status" className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm print:hidden ${tone}`}>
          {content}
        </div>
      )}
      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Changes that could not be saved</DialogTitle>
            <DialogDescription>
              These were made offline and the server did not accept them. Check the reason, then try again or remove the change.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-[60vh] flex-col gap-3 overflow-auto">
            {failed.map((c) => (
              <li key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">Made {formatDateTime(c.createdAt)}</p>
                <p className="mt-1 text-destructive">{c.error}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void offlineQueue.retry(c.id)}>
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void offlineQueue.discard(c.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
            {failed.length === 0 && (
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> Nothing left to review.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
