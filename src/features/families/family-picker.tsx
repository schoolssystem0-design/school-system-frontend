"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { families, type FamilyRow } from "@/lib/api/people";
import { cn } from "@/lib/utils";

/** Search an existing family by family no., parent name, phone or CNIC and pick one (FR 5.2: siblings share one). */
export function FamilyPicker({
  id,
  selected,
  onSelect,
}: {
  id: string;
  selected: FamilyRow | null;
  onSelect: (family: FamilyRow | null) => void;
}) {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["families", "pick", q],
    queryFn: () => families.list({ q }),
    enabled: q.trim().length >= 2,
  });
  return (
    <div className="flex flex-col gap-2">
      <Field id={id} label="Find family" hint="Type at least 2 characters: family no., parent name, phone or CNIC">
        <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </Field>
      {q.trim().length >= 2 && (
        <ul className="flex max-h-56 flex-col overflow-auto rounded-md border" aria-label="Matching families">
          {results.isPending ? (
            <li className="p-2 text-sm text-muted-foreground">Searching…</li>
          ) : (results.data?.items ?? []).length === 0 ? (
            <li className="p-2 text-sm text-muted-foreground">No family found</li>
          ) : (
            results.data?.items.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === f.id}
                  className={cn(
                    "flex w-full flex-wrap gap-x-3 px-2 py-1.5 text-left text-sm hover:bg-muted",
                    selected?.id === f.id && "bg-muted font-medium",
                  )}
                  onClick={() => onSelect(f)}
                >
                  <span>{f.familyNo}</span>
                  <span>{f.fatherName ?? f.motherName}</span>
                  <span className="text-muted-foreground">{f.fatherPhone}</span>
                  <span className="text-muted-foreground">{f.children} studying</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {selected && (
        <p className="text-sm">
          Selected: <strong>{selected.familyNo}</strong> — {selected.fatherName ?? selected.motherName}
        </p>
      )}
    </div>
  );
}
