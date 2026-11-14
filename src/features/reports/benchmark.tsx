"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Equal, Lightbulb, Lock } from "lucide-react";
import Link from "next/link";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { school, type Benchmark } from "@/lib/api/business";
import { cn } from "@/lib/utils";

type Measure = NonNullable<Benchmark["measures"]>[number];

const VERDICT: Record<string, { label: string; className: string; icon?: typeof Equal }> = {
  BETTER: { label: "Better than similar schools", className: "bg-emerald-600 text-white", icon: ArrowUpRight },
  SIMILAR: { label: "About the same", className: "bg-primary text-white", icon: Equal },
  BEHIND: { label: "Behind similar schools", className: "bg-highlight text-highlight-foreground", icon: ArrowDownRight },
  NO_DATA: { label: "No data here yet", className: "bg-muted text-foreground" },
  NOT_ENOUGH_SCHOOLS: { label: "Not enough similar schools yet", className: "bg-muted text-foreground" },
};

const show = (v: string | undefined, unit?: string) => (v == null ? "—" : `${Number(v).toLocaleString()}${unit === "%" ? "%" : ""}`);

/** How this school compares with the average of similar schools. Never shows another school's name or figures. */
export function BenchmarkPanel() {
  const q = useQuery({ queryKey: ["reports", "benchmark"], queryFn: school.benchmark, retry: false });
  if (q.isPending) return <Loading />;
  if (q.error instanceof ApiError && q.error.status === 403) {
    return <Empty title="Only staff who see the whole school can compare it">Ask an administrator.</Empty>;
  }
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const b = q.data;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>How we compare</CardTitle>
          <CardDescription>
            Your school ({b.studentsHere ?? 0} students) against the average of schools of {b.comparedWith}. Averages are of at
            least 5 schools; no school&apos;s name or figures are ever shown.
          </CardDescription>
        </CardHeader>
        {!b.sharing && (
          <CardContent>
            <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Your school does not share its averages, so you see only your own figures. To compare, turn on{" "}
                <Link href="/app/setup/rules" className="font-medium underline underline-offset-4">Compare with similar schools</Link>{" "}
                in Rules &amp; settings (General).
              </span>
            </p>
          </CardContent>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(b.measures ?? []).map((m) => (
          <MeasureCard key={m.key} m={m} />
        ))}
      </div>
    </div>
  );
}

function MeasureCard({ m }: { m: Measure }) {
  const v = VERDICT[m.verdict ?? ""] ?? VERDICT.NO_DATA;
  const Icon = v.icon;
  const mine = m.value == null ? null : Number(m.value);
  const avg = m.average == null ? null : Number(m.average);
  const max = Math.max(mine ?? 0, avg ?? 0, m.unit === "%" ? 100 : 1);
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-base">{m.label}</CardTitle>
        <Badge className={cn("w-fit", v.className)}>
          {Icon && <Icon aria-hidden />} {v.label}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Bar label="Your school" value={show(m.value, m.unit)} width={mine == null ? 0 : (mine / max) * 100} className="bg-primary" />
        <Bar
          label={m.schools ? `Average of ${m.schools} similar schools` : "Similar schools"}
          value={show(m.average, m.unit)}
          width={avg == null ? 0 : (avg / max) * 100}
          className="bg-muted-foreground/40"
        />
        {m.hint && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-highlight-ink" aria-hidden />
            {m.hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, width, className }: { label: string; value: string; width: number; className: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", className)} style={{ width: `${Math.min(100, Math.max(0, width))}%` }} />
      </div>
    </div>
  );
}
