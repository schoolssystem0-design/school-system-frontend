"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Cake,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardCheck,
  ClipboardPen,
  Contact,
  DoorOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  KeyRound,
  Megaphone,
  MessageSquareWarning,
  Pin,
  ShieldAlert,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, fileUrl, type Schemas } from "@/lib/api/client";
import { dashboard, messages, type Dashboard } from "@/lib/api/office";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/people/shared";
import { initials, navItems, useMe } from "@/features/shell/app-shell";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Colour families used for icon chips and accents; one per kind of figure so the page scans quickly. */
const TONE = {
  blue: { chip: "bg-primary/10 text-primary", glow: "from-primary/20", bar: "bg-primary" },
  navy: { chip: "bg-navy/[0.07] text-navy dark:bg-white/10 dark:text-white", glow: "from-navy/10", bar: "bg-navy" },
  orange: { chip: "bg-highlight/15 text-highlight-ink", glow: "from-highlight/25", bar: "bg-highlight" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", glow: "from-emerald-500/15", bar: "bg-emerald-600" },
  rose: { chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300", glow: "from-rose-500/15", bar: "bg-rose-500" },
  slate: { chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300", glow: "from-slate-500/15", bar: "bg-slate-500" },
} as const;
type Tone = keyof typeof TONE;

function IconChip({ icon: Icon, tone, className }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TONE[tone].chip, className)}>
      <Icon className="size-5" />
    </span>
  );
}

/** The dashboard panels (FR 3). The API sends only the panels this user may see. */
export function DashboardPanels() {
  const [reveal, setReveal] = useState(false);
  const data = useQuery({ queryKey: ["dashboard", reveal], queryFn: () => dashboard.get(reveal) });
  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const d = data.data;
  return (
    <div className="flex flex-col gap-6">
      {(d.urgent ?? []).length > 0 && <Urgent lines={d.urgent ?? []} />}
      <QuickBar favourites={d.favourites ?? []} />
      {(d.masked || reveal) && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReveal(!reveal)}>
            {reveal ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {reveal ? "Hide figures" : "Show figures"}
          </Button>
        </div>
      )}
      {d.totals && <TotalsRow totals={d.totals} />}
      {d.fees && <FeesRow fees={d.fees} />}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {d.attendance && <AttendanceCard a={d.attendance} />}
        {d.tasks && <TasksCard tasks={d.tasks} />}
        {d.complaints && <ComplaintsCard c={d.complaints} />}
        {d.register && <RegisterCard rows={d.register} />}
        {d.birthdays && <BirthdaysCard rows={d.birthdays} />}
        {d.events && <EventsCard rows={d.events} />}
        {d.circulars && <CircularsCard rows={d.circulars} />}
        {d.logins && <LoginsCard l={d.logins} />}
        {d.visitorsToday != null && <VisitorsCard n={d.visitorsToday} />}
      </div>
    </div>
  );
}

function Urgent({ lines }: { lines: NonNullable<Dashboard["urgent"]> }) {
  return (
    <section
      aria-labelledby="urgent-title"
      className="relative overflow-hidden rounded-2xl border border-highlight/30 bg-gradient-to-br from-highlight/15 via-highlight/5 to-card p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground shadow-md shadow-highlight/30">
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="urgent-title" className="text-sm font-semibold text-foreground">Needs action today</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {lines.map((l) => (
              <li key={`${l.code}-${l.text}`}>
                <Link
                  href={l.href ?? "/app"}
                  className="group flex items-center gap-2 rounded-lg bg-card/80 px-3 py-2 text-sm text-foreground ring-1 ring-highlight/25 transition hover:bg-card hover:ring-highlight/60"
                >
                  <span className="flex-1">{l.text}</span>
                  <ChevronRight className="size-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function QuickBar({ favourites }: { favourites: Schemas["Favourite"][] }) {
  const me = useMe();
  const [editing, setEditing] = useState(false);
  if (me.data?.actorType !== "USER") return null;
  const icons = new Map(navItems(me.data.permissions ?? []).map((n) => [n.href, n.icon]));
  return (
    <section aria-label="Quick bar" className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Zap className="size-3.5" aria-hidden /> Quick access
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {favourites.map((f) => {
          const Icon = icons.get(f.href ?? "") ?? ArrowUpRight;
          return (
            <Link
              key={f.href}
              href={f.href ?? "/app"}
              className="group flex shrink-0 items-center gap-2 rounded-full border bg-card py-1.5 ps-1.5 pe-3.5 text-sm font-medium shadow-xs transition hover:-translate-y-px hover:border-primary/40 hover:text-primary hover:shadow-md"
            >
              <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-3.5" />
              </span>
              {f.label}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 rounded-full border border-dashed px-4 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          <Pin className="size-3.5" aria-hidden />
          {favourites.length ? "Edit quick bar" : "Pin pages to a quick bar"}
        </Button>
      </div>
      {editing && <QuickBarDialog favourites={favourites} onClose={() => setEditing(false)} />}
    </section>
  );
}

function QuickBarDialog({ favourites, onClose }: { favourites: Schemas["Favourite"][]; onClose: () => void }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(() => favourites.map((f) => f.href ?? ""));
  const pages = navItems(me.data?.permissions ?? []).filter((n) => n.href !== "/app");
  const save = useMutation({
    mutationFn: () => dashboard.saveFavourites(pages.filter((p) => chosen.includes(p.href)).map((p) => ({ href: p.href, label: p.label }))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick bar</DialogTitle>
          <DialogDescription>Choose up to 12 pages to keep on your dashboard. Only you see them.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60svh] gap-1 overflow-y-auto sm:max-h-80 sm:grid-cols-2">
          {pages.map((p) => (
            <label
              key={p.href}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted has-data-checked:bg-primary/5"
            >
              <Checkbox
                checked={chosen.includes(p.href)}
                onCheckedChange={(v) => setChosen((c) => (v === true ? [...c, p.href] : c.filter((x) => x !== p.href)))}
              />
              <p.icon className="size-4 text-muted-foreground" aria-hidden />
              {p.label}
            </label>
          ))}
        </div>
        <p className={cn("text-xs", chosen.length > 12 ? "font-medium text-destructive" : "text-muted-foreground")}>
          {chosen.length} of 12 chosen
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending || chosen.length > 12} onClick={() => save.mutate()}>Save quick bar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tile({
  label,
  value,
  detail,
  href,
  icon,
  tone,
  children,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  icon: LucideIcon;
  tone: Tone;
  children?: React.ReactNode;
}) {
  const body = (
    <Card className="relative h-full gap-0 p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-primary/20 sm:p-5">
      <span aria-hidden className={cn("pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br to-transparent blur-2xl", TONE[tone].glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <IconChip icon={icon} tone={tone} />
      </div>
      <p className="relative mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {detail && <p className="relative mt-1 text-xs text-muted-foreground">{detail}</p>}
      {children}
      {href && (
        <ArrowUpRight
          aria-hidden
          className="absolute right-4 bottom-4 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    <div className="group h-full">{body}</div>
  );
}

function TotalsRow({ totals }: { totals: NonNullable<Dashboard["totals"]> }) {
  const boys = totals.boys ?? 0;
  const girls = totals.girls ?? 0;
  const boysShare = boys + girls === 0 ? 0 : Math.round((boys * 100) / (boys + girls));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label="Students" value={String(totals.students)} detail={`${totals.boys} boys, ${totals.girls} girls`} href="/app/students" icon={GraduationCap} tone="blue">
        {boys + girls > 0 && (
          <div aria-hidden className="relative mt-3 flex h-1.5 overflow-hidden rounded-full bg-highlight">
            <span className="h-full bg-primary" style={{ width: `${boysShare}%` }} />
          </div>
        )}
      </Tile>
      <Tile label="Families" value={String(totals.families)} href="/app/families" icon={Home} tone="orange" />
      <Tile label="Staff" value={String(totals.staff)} href="/app/staff" icon={Contact} tone="navy" />
    </div>
  );
}

function FeesRow({ fees }: { fees: NonNullable<Dashboard["fees"]> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label="Fees collected today" value={formatMoney(fees.collectedToday)} href="/app/fees/reports" icon={Banknote} tone="emerald" />
      <Tile label="Collected this month" value={formatMoney(fees.collectedThisMonth)} href="/app/fees/reports" icon={CalendarRange} tone="blue" />
      <Tile label="Fees outstanding" value={formatMoney(fees.outstanding)} href="/app/fees/defaulters" icon={AlarmClock} tone="rose" />
    </div>
  );
}

function Panel({
  title,
  description,
  href,
  linkLabel,
  icon,
  tone,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  icon: LucideIcon;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 p-0 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        <IconChip icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary transition-colors hover:bg-primary/10"
          >
            {linkLabel ?? "View all"}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="flex-1 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </Card>
  );
}

const Nothing = ({ text }: { text: string }) => (
  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{text}</p>
);

function AttendanceCard({ a }: { a: NonNullable<Dashboard["attendance"]> }) {
  const complete = (a.missing ?? []).length === 0;
  const sections = a.sections ?? 0;
  const progress = sections === 0 ? 0 : Math.round(((a.completed ?? 0) * 100) / sections);
  return (
    <Panel
      title="Attendance today"
      description={!a.workingDay ? "School is closed today" : complete ? `Complete: ${a.completed} of ${a.sections} classes` : `Incomplete: ${a.completed} of ${a.sections} classes`}
      href="/app/attendance"
      linkLabel="Open"
      icon={ClipboardCheck}
      tone="emerald"
    >
      <div className="flex flex-col gap-4 text-sm">
        {a.workingDay && sections > 0 && (
          <div
            role="progressbar"
            aria-label="Classes with attendance entered"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <span className={cn("block h-full rounded-full transition-all", complete ? "bg-emerald-600" : "bg-highlight")} style={{ width: `${progress}%` }} />
          </div>
        )}
        {(a.missing ?? []).length > 0 && (
          <p className="rounded-lg bg-highlight/10 px-3 py-2 text-highlight-ink">
            <span className="font-medium">Not entered:</span> {(a.missing ?? []).join(", ")}
          </p>
        )}
        <FigureRow label="Students" d={a.students} />
        {a.staff && <FigureRow label="Staff" d={a.staff} />}
        {(a.repeatedAbsences ?? 0) > 0 && (
          <p>
            <Link href="/app/attendance" className="inline-flex items-center gap-1.5 font-medium text-rose-700 underline-offset-4 hover:underline dark:text-rose-300">
              <AlertTriangle className="size-3.5" aria-hidden />
              {a.repeatedAbsences} absent several days in a row
            </Link>
          </p>
        )}
        <WeekBars days={a.lastSevenDays ?? []} />
      </div>
    </Panel>
  );
}

const FIGURE_PARTS = [
  { key: "present", label: "present", dot: "bg-emerald-500" },
  { key: "absent", label: "absent", dot: "bg-rose-500" },
  { key: "leave", label: "on leave", dot: "bg-primary" },
  { key: "late", label: "late", dot: "bg-highlight" },
] as const;

/** One person group's day: the same sentence as before for screen readers, shown as four coloured counters. */
function FigureRow({ label, d }: { label: string; d: Schemas["DayFigure"] | undefined }) {
  return (
    <div>
      <p className="sr-only">
        {label}: {figure(d)}
      </p>
      <div aria-hidden>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {FIGURE_PARTS.map((part) => (
            <div key={part.key} className="rounded-lg bg-muted/60 px-2 py-1.5">
              <p className="text-base font-semibold tabular-nums leading-tight">{d?.[part.key] ?? 0}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={cn("size-1.5 shrink-0 rounded-full", part.dot)} />
                <span className="truncate">{part.label}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function figure(d: Schemas["DayFigure"] | undefined) {
  return `${d?.present ?? 0} present, ${d?.absent ?? 0} absent, ${d?.leave ?? 0} on leave, ${d?.late ?? 0} late`;
}

/** Share of students present per day over the last seven days; one series, so no legend. */
function WeekBars({ days }: { days: Schemas["DayFigure"][] }) {
  if (days.length === 0) return null;
  const rows = days.map((d) => {
    const total = (d.present ?? 0) + (d.absent ?? 0) + (d.leave ?? 0);
    const percent = total === 0 ? 0 : Math.round(((d.present ?? 0) * 100) / total);
    return { date: d.date ?? "", percent, text: `${formatDate(d.date)}: ${percent}% present, ${d.present ?? 0} present, ${d.absent ?? 0} absent, ${d.leave ?? 0} on leave` };
  });
  return (
    <figure className="rounded-xl bg-muted/40 p-3">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">Students present, last 7 days</figcaption>
      <ul className="flex h-24 items-end gap-1.5 sm:gap-2" aria-label="Students present per day">
        {rows.map((r) => (
          <li key={r.date} className="group flex h-full flex-1 flex-col justify-end" title={r.text}>
            <span className="sr-only">{r.text}</span>
            <span aria-hidden className="mb-1 text-center text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {r.percent}%
            </span>
            <span
              aria-hidden
              className="block rounded-md bg-gradient-to-t from-primary to-primary/55 transition-all group-hover:to-primary/80"
              style={{ height: `${Math.max(r.percent, 3)}%` }}
            />
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-1.5 flex gap-1.5 text-center text-[10px] text-muted-foreground sm:gap-2">
        {rows.map((r) => <span key={r.date} className="flex-1">{r.date.slice(8)}</span>)}
      </div>
    </figure>
  );
}

function TasksCard({ tasks }: { tasks: NonNullable<Dashboard["tasks"]> }) {
  return (
    <Panel title="My tasks" href="/app/office/tasks" icon={ClipboardPen} tone="blue">
      {tasks.length === 0 ? <Nothing text="No open tasks." /> : (
        <ul className="flex flex-col divide-y text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-start gap-2">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", t.priority === "URGENT" ? "bg-rose-500" : t.overdue ? "bg-highlight" : "bg-primary/60")} />
                <span>
                  {t.description}
                  {t.priority === "URGENT" && (
                    <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">Urgent</span>
                  )}
                </span>
              </span>
              {t.deadline && (
                <span className={cn("whitespace-nowrap text-xs", t.overdue ? "rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-300" : "pt-0.5 text-muted-foreground")}>
                  {formatDate(t.deadline)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ComplaintsCard({ c }: { c: NonNullable<Dashboard["complaints"]> }) {
  const stats: [string, number | undefined, string][] = [
    ["Open", c.open, "bg-highlight/15 text-highlight-ink"],
    ["Closed", c.closed, "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"],
    ["Total", c.total, "bg-muted text-foreground"],
  ];
  return (
    <Panel title="Parent complaints" href="/app/office/complaints" icon={MessageSquareWarning} tone="orange">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {stats.map(([k, v, style]) => (
          <div key={k} className={cn("flex flex-col-reverse rounded-xl px-2 py-3", style)}>
            <dt className="text-xs font-medium opacity-80">{k}</dt>
            <dd className="text-2xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {(c.urgent ?? 0) > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-rose-700 dark:text-rose-300">
          <AlarmClock className="size-4" aria-hidden /> {c.urgent} open too long
        </p>
      )}
    </Panel>
  );
}

function RegisterCard({ rows }: { rows: NonNullable<Dashboard["register"]> }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const welcome = useMutation({
    mutationFn: (id: number) => messages.welcome(id),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (r.noPhone) toast.error("This family has no phone number for messages");
      else toast.success(r.alreadySent ? "Already welcomed" : "Welcome message queued");
    },
    onError,
  });
  return (
    <Panel title="Recent admissions and withdrawals" href="/app/students" icon={UserPlus} tone="blue">
      {rows.length === 0 ? <Nothing text="None this year." /> : (
        <ul className="flex flex-col divide-y text-sm">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.studentId}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    r.kind === "LEFT" ? "bg-slate-500/10 text-slate-600 dark:text-slate-300" : "bg-primary/10 text-primary",
                  )}
                >
                  {initials(r.name)}
                </span>
                <span className="min-w-0">
                  <Link href={`/app/students/${r.studentId}`} className="font-medium hover:text-primary hover:underline">{r.name}</Link>{" "}
                  <span className="block text-xs text-muted-foreground">
                    {r.className} · {r.kind === "LEFT" ? "Left" : "Admitted"} {r.daysAgo === 0 ? "today" : `${r.daysAgo}d ago`}
                  </span>
                </span>
              </span>
              {r.kind === "ADMITTED" && can(P.MESSAGES_SEND) && (
                r.welcomeSent ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Welcomed</span>
                ) : (
                  <Button variant="outline" size="sm" className="rounded-full" disabled={welcome.isPending} aria-label={`Welcome ${r.name}`} onClick={() => welcome.mutate(r.studentId ?? 0)}>Welcome</Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BirthdaysCard({ rows }: { rows: NonNullable<Dashboard["birthdays"]> }) {
  return (
    <Panel title="Birthdays this week" href="/app/office/birthdays" icon={Cake} tone="orange">
      {rows.length === 0 ? <Nothing text="No birthdays in the next 7 days." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((b) => {
            const photo = fileUrl(b.photoFileId);
            return (
              <li key={`${b.personType}-${b.id}`} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", b.daysLeft === 0 && "bg-highlight/10")}>
                {photo ? (
                  // Served by the API with the session cookie; next/image cannot fetch it
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="size-9 rounded-full object-cover ring-2 ring-highlight/40" />
                ) : (
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-highlight text-[11px] font-semibold text-highlight-foreground">
                    {initials(b.name)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{b.name}</span> <span className="block text-xs text-muted-foreground">{b.detail}</span>
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                    b.daysLeft === 0 ? "bg-highlight text-highlight-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {b.daysLeft === 0 ? "Today" : `${b.daysLeft}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** A small calendar-leaf showing the day and month of an ISO date. */
function DateLeaf({ date, tone }: { date?: string; tone: Tone }) {
  const d = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return (
    <span aria-hidden className="flex w-11 shrink-0 flex-col overflow-hidden rounded-lg border bg-card text-center leading-none">
      <span className={cn("py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white", TONE[tone].bar)}>
        {valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "—"}
      </span>
      <span className="py-1 text-base font-bold tabular-nums">{valid ? d.getDate() : ""}</span>
    </span>
  );
}

function EventsCard({ rows }: { rows: NonNullable<Dashboard["events"]> }) {
  return (
    <Panel title="Coming up" href="/app/office/calendar" linkLabel="Calendar" icon={CalendarDays} tone="navy">
      {rows.length === 0 ? <Nothing text="No events coming up." /> : (
        <ul className="flex flex-col gap-2.5 text-sm">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <DateLeaf date={e.dateFrom} tone="navy" />
              <span className="min-w-0 flex-1 font-medium">{e.title}</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(e.dateFrom)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CircularsCard({ rows }: { rows: NonNullable<Dashboard["circulars"]> }) {
  return (
    <Panel title="Latest circulars" href="/app/office/circulars" icon={Megaphone} tone="blue">
      {rows.length === 0 ? <Nothing text="No circulars yet." /> : (
        <ul className="flex flex-col divide-y text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-start gap-2">
                <Megaphone className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="font-medium">{c.title}</span>
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LoginsCard({ l }: { l: NonNullable<Dashboard["logins"]> }) {
  const groups = l.byType ?? [];
  const max = Math.max(1, ...groups.map((g) => g.logins ?? 0));
  return (
    <Panel title="Logins, last 7 days" href="/app/security" linkLabel="History" icon={KeyRound} tone="slate">
      <div className="flex flex-col gap-3 text-sm">
        {groups.length === 0 ? <Nothing text="No logins." /> : (
          <ul className="flex flex-col gap-2.5">
            {groups.map((g) => (
              <li key={g.userType}>
                <div className="flex justify-between gap-2">
                  <span className="capitalize">{(g.userType ?? "").toLowerCase().replaceAll("_", " ")}</span>
                  <span className="font-semibold tabular-nums">{g.logins}</span>
                </div>
                <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${((g.logins ?? 0) * 100) / max}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {(l.failed ?? 0) > 0 && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldAlert className="size-4 text-rose-500" aria-hidden /> {l.failed} failed attempts
          </p>
        )}
        {(l.newLocations ?? []).map((a) => (
          <p key={`${a.username}-${a.at}`} className="flex items-start gap-1.5 rounded-lg bg-highlight/10 px-3 py-2 font-medium text-highlight-ink">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> New location: {a.username}, {formatDateTime(a.at)}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function VisitorsCard({ n }: { n: number }) {
  return (
    <Panel title="Visitors today" href="/app/office/visitors" linkLabel="Log" icon={DoorOpen} tone="orange">
      <div className="flex items-end gap-2">
        <p className="text-4xl font-bold tracking-tight tabular-nums">{n}</p>
        <p className="pb-1.5 text-sm text-muted-foreground">{n === 1 ? "visitor signed in" : "visitors signed in"}</p>
      </div>
    </Panel>
  );
}
