"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Building2, CalendarClock, Flame, GraduationCap, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { ErrorState, Loading } from "@/components/app/data-state";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billing, type BusinessDashboard } from "@/lib/api/business";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StandingBadge } from "./billing";

const INTEREST: Record<string, { label: string; className: string }> = {
  HOT: { label: "Hot", className: "bg-destructive text-white" },
  WARM: { label: "Warm", className: "bg-highlight text-highlight-foreground" },
  COLD: { label: "Cold", className: "bg-muted text-foreground" },
};

const HEALTH: Record<string, { label: string; dot: string }> = {
  RED: { label: "Needs a call", dot: "bg-destructive" },
  AMBER: { label: "Watch", dot: "bg-highlight" },
  GREEN: { label: "Healthy", dot: "bg-emerald-600" },
};

const lastSeen = (v?: string) => (v ? formatDateTime(v) : "Never");

/** The owner's business at a glance: money, trials to follow up, schools at risk, growth. */
export function BusinessDashboardPage() {
  const q = useQuery({ queryKey: ["platform", "dashboard"], queryFn: billing.dashboard, refetchInterval: 5 * 60_000 });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const h = d.headline ?? {};
  const c = d.conversion ?? {};
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Business dashboard" description="Your schools, trials and money in one place. Schools marked red need a call today." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Building2} label="Schools" value={h.schools ?? 0} detail={`${h.paying ?? 0} paying · ${h.onTrial ?? 0} on trial`} />
        <StatTile icon={GraduationCap} label="Students" value={(h.students ?? 0).toLocaleString()} detail={`${h.activeUsers7d ?? 0} staff used it this week`} tone="success" />
        <StatTile icon={CalendarClock} label="Expected this month" value={formatMoney(h.expectedThisMonth)} detail={`Received ${formatMoney(h.receivedThisMonth)}`} />
        <StatTile icon={Receipt} label="Overdue" value={formatMoney(h.overdue)} detail={`${h.paused ?? 0} schools paused`} tone={h.paused ? "danger" : "warning"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-5 text-destructive" aria-hidden /> Trials to follow up
            </CardTitle>
            <CardDescription>
              Hot trials use the system every day: call them before the trial ends. {h.trialsEndingThisWeek ?? 0} end this week.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <TrialsTable trials={d.trials ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-emerald-600" aria-hidden /> Trial to paid
            </CardTitle>
            <CardDescription>Schools that started paying after a free trial.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-4xl font-bold tabular-nums">{c.ratePercent ?? 0}%</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">This month</dt>
                <dd className="font-medium">{c.convertedThisMonth ?? 0} of {c.trialsThisMonth ?? 0} trials</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">All time</dt>
                <dd className="font-medium">{c.convertedAllTime ?? 0} of {c.trialsAllTime ?? 0} trials</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-highlight-ink" aria-hidden /> School health
          </CardTitle>
          <CardDescription>
            Red: unpaid past grace, no one signed in for a week, or the SMS phone is offline. Amber: little use or failing messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <HealthTable schools={d.schools ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden /> Growth
          </CardTitle>
          <CardDescription>Schools and students at the end of each of the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <GrowthChart points={d.growth ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

function TrialsTable({ trials }: { trials: NonNullable<BusinessDashboard["trials"]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>School</TableHead>
          <TableHead>Interest</TableHead>
          <TableHead className="text-right">Days left</TableHead>
          <TableHead className="text-right">Students</TableHead>
          <TableHead className="text-right">Registers (7 days)</TableHead>
          <TableHead>Last sign-in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trials.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No schools on a trial right now</TableCell>
          </TableRow>
        )}
        {trials.map((t) => {
          const i = INTEREST[t.interest ?? ""] ?? INTEREST.COLD;
          return (
            <TableRow key={t.schoolId}>
              <TableCell>
                <Link href={`/platform/schools/${t.schoolId}`} className="font-medium underline-offset-4 hover:underline">{t.name}</Link>
                <span className="block text-xs text-muted-foreground">{t.code}</span>
              </TableCell>
              <TableCell><Badge className={i.className}>{i.label}</Badge></TableCell>
              <TableCell className={cn("text-right tabular-nums", (t.daysLeft ?? 0) <= 3 && "font-semibold text-destructive")}>{t.daysLeft}</TableCell>
              <TableCell className="text-right tabular-nums">{t.students}</TableCell>
              <TableCell className="text-right tabular-nums">{t.registers7d}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{lastSeen(t.lastSignIn)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function HealthTable({ schools }: { schools: NonNullable<BusinessDashboard["schools"]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>School</TableHead>
          <TableHead>Health</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead className="text-right">Students</TableHead>
          <TableHead className="text-right">Staff (7 days)</TableHead>
          <TableHead className="text-right">Fee payments (30 days)</TableHead>
          <TableHead className="text-right">SMS (30 days)</TableHead>
          <TableHead>Last sign-in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schools.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">No schools yet</TableCell>
          </TableRow>
        )}
        {schools.map((s) => {
          const h = HEALTH[s.health ?? ""] ?? HEALTH.GREEN;
          return (
            <TableRow key={s.schoolId}>
              <TableCell>
                <Link href={`/platform/schools/${s.schoolId}`} className="font-medium underline-offset-4 hover:underline">{s.name}</Link>
                <span className="block text-xs text-muted-foreground">{s.code}</span>
              </TableCell>
              <TableCell className="min-w-48">
                <span className="flex items-center gap-2 font-medium">
                  <span className={cn("size-2.5 shrink-0 rounded-full", h.dot)} aria-hidden /> {h.label}
                </span>
                {(s.reasons ?? []).length > 0 && (
                  <ul className="mt-0.5 text-xs text-muted-foreground">
                    {(s.reasons ?? []).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
              </TableCell>
              <TableCell>{s.standing ? <StandingBadge standing={s.standing} /> : <span className="text-sm">{s.plan}</span>}</TableCell>
              <TableCell className="text-right tabular-nums">{s.students}</TableCell>
              <TableCell className="text-right tabular-nums">{s.activeUsers7d}</TableCell>
              <TableCell className="text-right tabular-nums">{s.payments30d}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.sms30d}
                {(s.smsFailed30d ?? 0) > 0 && <span className="block text-xs text-destructive">{s.smsFailed30d} failed</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{lastSeen(s.lastSignIn)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function GrowthChart({ points }: { points: NonNullable<BusinessDashboard["growth"]> }) {
  const max = Math.max(1, ...points.map((p) => p.students ?? 0));
  if (points.length === 0) return <p className="text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className="overflow-x-auto">
      <ol className="flex h-48 min-w-[560px] items-end gap-2" aria-label="Students by month">
        {points.map((p) => (
          <li key={p.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] tabular-nums text-muted-foreground">{(p.students ?? 0).toLocaleString()}</span>
            <span
              className="w-full max-w-10 rounded-t-md bg-primary/80"
              style={{ height: `${Math.max(2, ((p.students ?? 0) / max) * 100)}%` }}
              title={`${p.month}: ${p.students} students in ${p.schools} schools`}
            />
            <span className="text-[11px] text-muted-foreground">{p.month}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{p.schools} sch.</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
