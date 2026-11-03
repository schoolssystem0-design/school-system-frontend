"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setAcademicYear } from "@/lib/api/client";
import { school, type Year } from "@/lib/api/endpoints";

type YearState = {
  years: Year[];
  selected: Year | null;
  current: Year | null;
  select: (id: number) => void;
  isLoading: boolean;
};

const YearContext = createContext<YearState | null>(null);

const storageKey = (schoolId: number) => `sms.year.${schoolId}`;

/**
 * The academic year the user is looking at (FR 1.2). Defaults to the school's current year; the choice is remembered
 * per school and sent to the API as X-Academic-Year, so lists and reports never mix years.
 */
export function YearProvider({ schoolId, children }: { schoolId: number; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const years = useQuery({ queryKey: ["school", schoolId, "years"], queryFn: school.years });
  const [chosenId, setChosenId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(storageKey(schoolId));
    return stored ? Number(stored) : null;
  });

  const list = useMemo(() => years.data ?? [], [years.data]);
  const current = list.find((y) => y.status === "CURRENT") ?? null;
  const selected = list.find((y) => y.id === chosenId) ?? current ?? list[0] ?? null;

  useEffect(() => {
    // Only send the header when the user picked a year other than the current one.
    setAcademicYear(selected && selected.id !== current?.id ? (selected.id ?? null) : null);
  }, [selected, current]);

  const select = useCallback(
    (id: number) => {
      setChosenId(id);
      window.localStorage.setItem(storageKey(schoolId), String(id));
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
    [queryClient, schoolId],
  );

  return (
    <YearContext.Provider value={{ years: list, selected, current, select, isLoading: years.isPending }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const value = useContext(YearContext);
  if (!value) throw new Error("useYear must be used inside YearProvider");
  return value;
}
