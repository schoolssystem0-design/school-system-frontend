"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { students, type StudentRow } from "@/lib/api/people";
import { formatMoney } from "@/lib/format";
import { fromPaisa, toPaisa } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Search a student by name, GR number, father's name or phone and pick one. */
export function StudentPicker({
  id,
  selected,
  onSelect,
  label = "Find student",
}: {
  id: string;
  selected: StudentRow | null;
  onSelect: (student: StudentRow | null) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["students", "pick", q],
    queryFn: () => students.list({ q, status: "ALL", size: 10 }),
    enabled: q.trim().length >= 2,
  });
  return (
    <div className="flex flex-col gap-2">
      <Field id={id} label={label} hint="Name, GR no., father's name or phone (at least 2 characters)">
        <Input id={id} value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      </Field>
      {q.trim().length >= 2 && (
        <ul className="flex max-h-56 flex-col overflow-auto rounded-md border" aria-label="Matching students">
          {results.isPending ? (
            <li className="p-2 text-sm text-muted-foreground">Searching…</li>
          ) : (results.data?.items ?? []).length === 0 ? (
            <li className="p-2 text-sm text-muted-foreground">No student found</li>
          ) : (
            results.data?.items.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === s.id}
                  className={cn(
                    "flex w-full flex-wrap gap-x-3 px-2 py-1.5 text-left text-sm hover:bg-muted",
                    selected?.id === s.id && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    onSelect(s);
                    setQ("");
                  }}
                >
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">GR {s.grNo}</span>
                  <span className="text-muted-foreground">{s.className ? `${s.className} - ${s.sectionName}` : "Left"}</span>
                  <span className="text-muted-foreground">{s.fatherName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {selected && (
        <p className="text-sm">
          Selected: <strong>{selected.name}</strong> (GR {selected.grNo})
        </p>
      )}
    </div>
  );
}

/** Money with a colour: owed (red), nothing due (muted) or credit (green, for negative balances). */
export function Balance({ value }: { value: string | null | undefined }) {
  const p = toPaisa(value ?? "0");
  if (p === 0n) return <span className="text-muted-foreground">{formatMoney("0")}</span>;
  if (p < 0n) return <span className="text-emerald-700 dark:text-emerald-400">{formatMoney(fromPaisa(-p))} credit</span>;
  return <span className="font-medium text-destructive">{formatMoney(value)}</span>;
}

export function BillStatus({ status }: { status?: string }) {
  const labels: Record<string, string> = { PAID: "Paid", PARTIAL: "Part paid", UNPAID: "Unpaid", CANCELLED: "Cancelled" };
  const variant = status === "PAID" ? "default" : status === "UNPAID" ? "destructive" : "secondary";
  return <Badge variant={variant}>{labels[status ?? ""] ?? status}</Badge>;
}

export function RequestStatus({ status }: { status?: string }) {
  const variant = status === "APPROVED" ? "default" : status === "PENDING" ? "outline" : "secondary";
  const labels: Record<string, string> = { APPROVED: "Approved", PENDING: "Waiting for approval", REJECTED: "Rejected", ENDED: "Ended" };
  return <Badge variant={variant}>{labels[status ?? ""] ?? status}</Badge>;
}
