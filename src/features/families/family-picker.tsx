"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { families, type FamilyRow } from "@/lib/api/people";
import { cn } from "@/lib/utils";
import { browserOffline, isNetworkError } from "@/lib/offline/queue";

/** Families matching a search (family no., parent name or phone), like the online search. */
export function searchFamilies(all: FamilyRow[], q: string) {
  const text = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  return all
    .filter(
      (f) =>
        (f.familyNo ?? "").toLowerCase() === text ||
        (f.fatherName ?? "").toLowerCase().includes(text) ||
        (f.motherName ?? "").toLowerCase().includes(text) ||
        (digits.length >= 4 && (f.fatherPhone ?? "").includes(digits)),
    )
    .slice(0, 10);
}

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
  const queryClient = useQueryClient();
  const results = useQuery({
    queryKey: ["families", "pick", q],
    queryFn: async () => {
      // No internet: search the family list kept on this device (for admitting brothers and sisters)
      const offline = () => {
        const all = queryClient.getQueryData<FamilyRow[]>(["families", "offline-list"]);
        if (!all) return null;
        const items = searchFamilies(all, q);
        return { items, page: 0, size: items.length, totalItems: items.length, totalPages: 1 } as Awaited<ReturnType<typeof families.list>>;
      };
      if (browserOffline()) {
        const found = offline();
        if (found) return found;
      }
      try {
        return await families.list({ q });
      } catch (error) {
        const found = isNetworkError(error) ? offline() : null;
        if (found) return found;
        throw error;
      }
    },
    enabled: q.trim().length >= 2,
    networkMode: "always",
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
