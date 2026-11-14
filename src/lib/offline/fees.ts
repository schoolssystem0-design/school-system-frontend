/**
 * The fee counter without internet: students, family dues and open lines come from the snapshot kept on this device
 * (downloaded in the background while online), minus payments taken offline that are still waiting to be sent.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { Schemas } from "@/lib/api/client";
import type { OfflineChange } from "./queue";

export const SNAPSHOT_KEY = ["fees", "offline-snapshot"] as const;

type Snapshot = Schemas["FeeSnapshot"];

export function snapshotOf(client: QueryClient) {
  return client.getQueryData<Snapshot>(SNAPSHOT_KEY);
}

/** Students matching a search (name, GR no., father's name or phone), like the online search. */
export function searchSnapshot(snapshot: Snapshot, q: string): Schemas["StudentRow"][] {
  const text = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  return (snapshot.students ?? [])
    .filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(text) ||
        (s.fatherName ?? "").toLowerCase().includes(text) ||
        (s.grNo ?? "").replace(/^0+/, "") === text.replace(/^0+/, "") ||
        (digits.length >= 4 && (s.fatherPhone ?? "").includes(digits)),
    )
    .slice(0, 10)
    .map((s) => ({
      id: s.id,
      grNo: s.grNo,
      name: s.name,
      gender: s.gender,
      className: s.className,
      sectionName: s.sectionName,
      sectionId: s.sectionId,
      familyId: s.familyId,
      fatherName: s.fatherName,
      fatherPhone: s.fatherPhone,
      status: s.status,
    }));
}

/** A family's dues from the snapshot (for one child when studentId is given). */
export function familyFromSnapshot(snapshot: Snapshot, familyId: number, studentId?: number) {
  const family = (snapshot.families ?? []).find((f) => f.familyId === familyId);
  if (!family) return null;
  const lines = (family.lines ?? []).filter((l) => studentId == null || l.studentId === studentId);
  const ledger: Schemas["Ledger"] = { owed: family.owed, credit: family.credit, balance: family.balance, entries: [] };
  return { ledger, lines };
}

/** Payments for this family taken offline and not sent yet (in paisa). */
export function pendingPaisa(changes: OfflineChange[], familyId: number) {
  return changes
    .filter((c) => c.kind === "payment" && c.meta?.familyId === familyId)
    .reduce((sum, c) => sum + BigInt(Math.round(Number(c.meta?.amount ?? 0) * 100)), 0n);
}
