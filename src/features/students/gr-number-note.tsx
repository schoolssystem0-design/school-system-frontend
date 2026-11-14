"use client";

import { useQuery } from "@tanstack/react-query";
import { Hash } from "lucide-react";
import { students } from "@/lib/api/people";
import { isNetworkError } from "@/lib/offline/queue";
import { useNoInternet } from "@/features/shell/offline-bar";

/** The GR number is given by the system; this shows the one the next admission will get. */
export function GrNumberNote() {
  const next = useQuery({ queryKey: ["students", "suggest-gr"], queryFn: students.suggestGr });
  // Offline the next number is not known: the server gives it when the admission is sent
  const offline = useNoInternet() || (next.isError && isNetworkError(next.error));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">GR no.</span>
      <div className="flex h-9 items-center gap-2 rounded-md border border-dashed bg-muted/50 px-3 text-sm">
        <Hash className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold tabular-nums">{next.data?.grNo ?? (offline ? "Given when sent" : "…")}</span>
        <span className="truncate text-xs text-muted-foreground">assigned automatically</span>
      </div>
    </div>
  );
}
