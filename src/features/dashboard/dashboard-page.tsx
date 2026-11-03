"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, fileUrl, type Schemas } from "@/lib/api/client";
import { dashboard, messages, type Dashboard } from "@/lib/api/office";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useCan } from "@/features/people/shared";
import { navItems, useMe } from "@/features/shell/app-shell";

const onError = (e: unknown) => toast.error(errorMessage(e));

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
        <div>
          <Button variant="outline" size="sm" onClick={() => setReveal(!reveal)}>
            {reveal ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {reveal ? "Hide figures" : "Show figures"}
          </Button>
        </div>
      )}
      {d.totals && <TotalsRow totals={d.totals} />}
      {d.fees && <FeesRow fees={d.fees} />}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="pt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4 text-amber-700" aria-hidden /> Needs action today
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {lines.map((l) => (
            <li key={`${l.code}-${l.text}`}>
              <Link href={l.href ?? "/app"} className="underline-offset-4 hover:underline">{l.text}</Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function QuickBar({ favourites }: { favourites: Schemas["Favourite"][] }) {
  const me = useMe();
  const [editing, setEditing] = useState(false);
  if (me.data?.actorType !== "USER") return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Quick bar">
      {favourites.map((f) => (
        <Button key={f.href} variant="secondary" size="sm" render={<Link href={f.href ?? "/app"} />}>{f.label}</Button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{favourites.length ? "Edit quick bar" : "Pin pages to a quick bar"}</Button>
      {editing && <QuickBarDialog favourites={favourites} onClose={() => setEditing(false)} />}
    </div>
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
        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {pages.map((p) => (
            <label key={p.href} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chosen.includes(p.href)}
                onCheckedChange={(v) => setChosen((c) => (v === true ? [...c, p.href] : c.filter((x) => x !== p.href)))}
              />
              {p.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending || chosen.length > 12} onClick={() => save.mutate()}>Save quick bar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, detail, href }: { label: string; value: string; detail?: string; href?: string }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function TotalsRow({ totals }: { totals: NonNullable<Dashboard["totals"]> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label="Students" value={String(totals.students)} detail={`${totals.boys} boys, ${totals.girls} girls`} href="/app/students" />
      <Tile label="Families" value={String(totals.families)} href="/app/families" />
      <Tile label="Staff" value={String(totals.staff)} href="/app/staff" />
    </div>
  );
}

function FeesRow({ fees }: { fees: NonNullable<Dashboard["fees"]> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label="Fees collected today" value={formatMoney(fees.collectedToday)} href="/app/fees/reports" />
      <Tile label="Collected this month" value={formatMoney(fees.collectedThisMonth)} href="/app/fees/reports" />
      <Tile label="Fees outstanding" value={formatMoney(fees.outstanding)} href="/app/fees/defaulters" />
    </div>
  );
}

function Panel({ title, description, href, linkLabel, children }: { title: string; description?: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {href && <Link href={href} className="whitespace-nowrap text-sm underline-offset-4 hover:underline">{linkLabel ?? "View all"}</Link>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Nothing = ({ text }: { text: string }) => <p className="text-sm text-muted-foreground">{text}</p>;

function AttendanceCard({ a }: { a: NonNullable<Dashboard["attendance"]> }) {
  const complete = (a.missing ?? []).length === 0;
  return (
    <Panel
      title="Attendance today"
      description={!a.workingDay ? "School is closed today" : complete ? `Complete: ${a.completed} of ${a.sections} classes` : `Incomplete: ${a.completed} of ${a.sections} classes`}
      href="/app/attendance"
      linkLabel="Open"
    >
      <div className="flex flex-col gap-3 text-sm">
        {(a.missing ?? []).length > 0 && <p><span className="font-medium">Not entered:</span> {(a.missing ?? []).join(", ")}</p>}
        <p>Students: {figure(a.students)}</p>
        {a.staff && <p>Staff: {figure(a.staff)}</p>}
        {(a.repeatedAbsences ?? 0) > 0 && (
          <p><Link href="/app/attendance" className="font-medium underline-offset-4 hover:underline">{a.repeatedAbsences} absent several days in a row</Link></p>
        )}
        <WeekBars days={a.lastSevenDays ?? []} />
      </div>
    </Panel>
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
    <figure>
      <figcaption className="mb-1 text-xs text-muted-foreground">Students present, last 7 days</figcaption>
      <ul className="flex h-24 items-end gap-2 border-b" aria-label="Students present per day">
        {rows.map((r) => (
          <li key={r.date} className="flex h-full flex-1 flex-col justify-end" title={r.text}>
            <span className="sr-only">{r.text}</span>
            <span aria-hidden className="block rounded-t bg-primary" style={{ height: `${Math.max(r.percent, 2)}%` }} />
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-1 flex gap-2 text-center text-[10px] text-muted-foreground">
        {rows.map((r) => <span key={r.date} className="flex-1">{r.date.slice(8)}</span>)}
      </div>
    </figure>
  );
}

function TasksCard({ tasks }: { tasks: NonNullable<Dashboard["tasks"]> }) {
  return (
    <Panel title="My tasks" href="/app/office/tasks">
      {tasks.length === 0 ? <Nothing text="No open tasks." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <span>{t.description}{t.priority === "URGENT" && <span className="ml-2 text-xs font-semibold text-red-700">Urgent</span>}</span>
              {t.deadline && <span className={t.overdue ? "whitespace-nowrap font-medium text-red-700" : "whitespace-nowrap text-muted-foreground"}>{formatDate(t.deadline)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ComplaintsCard({ c }: { c: NonNullable<Dashboard["complaints"]> }) {
  return (
    <Panel title="Parent complaints" href="/app/office/complaints">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[["Open", c.open], ["Closed", c.closed], ["Total", c.total]].map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-2xl font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {(c.urgent ?? 0) > 0 && <p className="mt-2 text-sm font-medium text-red-700">{c.urgent} open too long</p>}
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
    <Panel title="Recent admissions and withdrawals" href="/app/students">
      {rows.length === 0 ? <Nothing text="None this year." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.studentId}`} className="flex items-center justify-between gap-2">
              <span>
                <Link href={`/app/students/${r.studentId}`} className="font-medium hover:underline">{r.name}</Link>{" "}
                <span className="text-xs text-muted-foreground">{r.className} · {r.kind === "LEFT" ? "Left" : "Admitted"} {r.daysAgo === 0 ? "today" : `${r.daysAgo}d ago`}</span>
              </span>
              {r.kind === "ADMITTED" && can(P.MESSAGES_SEND) && (
                r.welcomeSent ? <span className="text-xs text-muted-foreground">Welcomed</span> : (
                  <Button variant="outline" size="sm" disabled={welcome.isPending} aria-label={`Welcome ${r.name}`} onClick={() => welcome.mutate(r.studentId ?? 0)}>Welcome</Button>
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
    <Panel title="Birthdays this week" href="/app/office/birthdays">
      {rows.length === 0 ? <Nothing text="No birthdays in the next 7 days." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((b) => {
            const photo = fileUrl(b.photoFileId);
            return (
              <li key={`${b.personType}-${b.id}`} className="flex items-center gap-2">
                {photo ? (
                  // Served by the API with the session cookie; next/image cannot fetch it
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="size-8 rounded-full object-cover" />
                ) : <span aria-hidden className="size-8 rounded-full bg-muted" />}
                <span className="flex-1">{b.name} <span className="text-xs text-muted-foreground">{b.detail}</span></span>
                <span className="whitespace-nowrap text-muted-foreground">{b.daysLeft === 0 ? "Today" : `${b.daysLeft}d`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function EventsCard({ rows }: { rows: NonNullable<Dashboard["events"]> }) {
  return (
    <Panel title="Coming up" href="/app/office/calendar" linkLabel="Calendar">
      {rows.length === 0 ? <Nothing text="No events coming up." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span>{e.title}</span>
              <span className="whitespace-nowrap text-muted-foreground">{formatDate(e.dateFrom)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CircularsCard({ rows }: { rows: NonNullable<Dashboard["circulars"]> }) {
  return (
    <Panel title="Latest circulars" href="/app/office/circulars">
      {rows.length === 0 ? <Nothing text="No circulars yet." /> : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{c.title}</span>
              <span className="whitespace-nowrap text-muted-foreground">{formatDate(c.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LoginsCard({ l }: { l: NonNullable<Dashboard["logins"]> }) {
  return (
    <Panel title="Logins, last 7 days" href="/app/security" linkLabel="History">
      <div className="flex flex-col gap-2 text-sm">
        {(l.byType ?? []).length === 0 ? <Nothing text="No logins." /> : (
          <ul className="flex flex-col gap-1">
            {(l.byType ?? []).map((g) => (
              <li key={g.userType} className="flex justify-between"><span>{g.userType}</span><span className="tabular-nums">{g.logins}</span></li>
            ))}
          </ul>
        )}
        {(l.failed ?? 0) > 0 && <p className="text-muted-foreground">{l.failed} failed attempts</p>}
        {(l.newLocations ?? []).map((a) => (
          <p key={`${a.username}-${a.at}`} className="flex items-center gap-1 font-medium text-amber-800">
            <AlertTriangle className="size-3.5" aria-hidden /> New location: {a.username}, {formatDateTime(a.at)}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function VisitorsCard({ n }: { n: number }) {
  return (
    <Panel title="Visitors today" href="/app/office/visitors" linkLabel="Log">
      <p className="text-3xl font-semibold tabular-nums">{n}</p>
    </Panel>
  );
}
