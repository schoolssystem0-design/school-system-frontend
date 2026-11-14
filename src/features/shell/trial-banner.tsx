"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

/** Shown to a school on its free trial: how many days are left and that the data is kept. */
export function TrialBanner({ endsAt }: { endsAt: string }) {
  const [now] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / DAY));
  const soon = left <= 3;
  return (
    <div
      role="status"
      className={
        "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-sm print:hidden " +
        (soon ? "bg-highlight text-highlight-foreground" : "bg-primary/10 text-foreground")
      }
    >
      <Sparkles className="size-4 shrink-0" aria-hidden />
      <span>
        <strong>Free trial:</strong>{" "}
        {left === 0 ? "ends today" : `${left} ${left === 1 ? "day" : "days"} left`} (until {formatDate(endsAt)}).
      </span>
      <span className={soon ? "" : "text-muted-foreground"}>Contact us to continue: all your data is kept.</span>
    </div>
  );
}
