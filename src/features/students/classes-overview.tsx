"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Layers, Users, UserCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import { useYear } from "@/features/shell/year-context";
import { ClassListDownload, DownloadMenu } from "@/features/reports/record-downloads";

type Overview = Schemas["SchoolOverview"];
type ClassRow = Schemas["ClassOverview"];
type SectionRow = Schemas["SectionOverview"];

/** Every class with its sections: boys, girls, class teacher, today's attendance, this month and fees (FR 5.7). */
export function ClassesOverview() {
  const { selected } = useYear();
  const overview = useQuery({
    queryKey: ["reports", "classes-overview", selected?.id],
    queryFn: () => api<Overview>("/reports/classes-overview"),
  });
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const classes = o.classes ?? [];
  if (classes.length === 0) return <Empty title="No classes yet">Add classes and sections in School setup.</Empty>;
  const allOpen = classes.every((c) => open.has(c.classId ?? 0));
  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const fees = classes.flatMap((c) => c.sections ?? []).reduce((sum, s) => sum + Number(s.feesOutstanding ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Layers} label="Classes" value={classes.length} detail={`${o.sections} sections`} />
        <Stat icon={Users} label="Students" value={o.total ?? 0} detail={`${o.boys} boys · ${o.girls} girls`} />
        {o.today ? (
          <Stat
            icon={UserCheck}
            label="Present today"
            value={o.presentToday ?? 0}
            detail={`${o.absentToday} absent · ${o.sectionsMarked}/${o.sections} registers marked`}
          />
        ) : (
          <Stat icon={UserCheck} label="Students on" value={formatDate(o.on)} detail={`Academic year ${o.year}`} />
        )}
        {o.fees && <Stat icon={Wallet} label="Fees outstanding" value={formatMoney(fees.toFixed(2))} detail="All classes" />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(classes.map((c) => c.classId ?? 0)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
        <DownloadMenu label="Download" path="/reports/classes-overview/file" fileName="classes-and-sections" />
      </div>

      {classes.map((c) => (
        <ClassCard key={c.classId} c={c} o={o} open={open.has(c.classId ?? 0)} onToggle={() => toggle(c.classId ?? 0)} />
      ))}

      <Card className="bg-muted/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <span className="font-semibold">School total</span>
          <span className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
            <span>{o.sections} sections</span>
            <span>Boys {o.boys}</span>
            <span>Girls {o.girls}</span>
            <span className="font-semibold">Total {o.total}</span>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: React.ReactNode; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{detail}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

function ClassCard({ c, o, open, onToggle }: { c: ClassRow; o: Overview; open: boolean; onToggle: () => void }) {
  const sections = c.sections ?? [];
  const [openSection, setOpenSection] = useState<number | null>(null);
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-2 font-semibold">
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
          {c.className}
          <Badge variant="secondary">
            {sections.length} {sections.length === 1 ? "section" : "sections"}
          </Badge>
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
          <span>Boys {c.boys}</span>
          <span>Girls {c.girls}</span>
          <span className="font-semibold text-foreground">Total {c.total}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead>Class teacher</TableHead>
                <TableHead className="text-right">Boys</TableHead>
                <TableHead className="text-right">Girls</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Left</TableHead>
                {o.today && <TableHead>Today</TableHead>}
                <TableHead className="text-right">Month %</TableHead>
                {o.fees && <TableHead className="text-right">Fees due</TableHead>}
                {o.fees && <TableHead className="text-right">Defaulters</TableHead>}
                <TableHead>
                  <span className="sr-only">Students</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((s) => (
                <SectionRows
                  key={s.sectionId}
                  s={s}
                  o={o}
                  open={openSection === s.sectionId}
                  onToggle={() => setOpenSection(openSection === s.sectionId ? null : (s.sectionId ?? null))}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function SectionRows({ s, o, open, onToggle }: { s: SectionRow; o: Overview; open: boolean; onToggle: () => void }) {
  const columns = 9 + (o.today ? 1 : 0) + (o.fees ? 2 : 0);
  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          {s.className} - {s.sectionName}
        </TableCell>
        <TableCell>{s.classTeacher ?? <span className="text-muted-foreground">Not set</span>}</TableCell>
        <TableCell className="text-right tabular-nums">{s.boys}</TableCell>
        <TableCell className="text-right tabular-nums">{s.girls}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{s.total}</TableCell>
        <TableCell className="text-right tabular-nums">{s.newThisYear}</TableCell>
        <TableCell className="text-right tabular-nums">{s.leftThisYear}</TableCell>
        {o.today && (
          <TableCell className="whitespace-nowrap">
            {s.markedToday ? (
              <span className="tabular-nums">
                {s.presentToday} present{(s.absentToday ?? 0) > 0 && <span className="text-destructive"> · {s.absentToday} absent</span>}
              </span>
            ) : (
              <Badge variant="outline" className="border-highlight/50 text-highlight-ink">
                Not marked
              </Badge>
            )}
          </TableCell>
        )}
        <TableCell className="text-right tabular-nums">{s.monthAttendance ? `${s.monthAttendance}%` : "—"}</TableCell>
        {o.fees && <TableCell className="text-right tabular-nums">{formatMoney(s.feesOutstanding)}</TableCell>}
        {o.fees && (
          <TableCell className={"text-right tabular-nums" + ((s.defaulters ?? 0) > 0 ? " font-semibold text-destructive" : "")}>
            {s.defaulters}
          </TableCell>
        )}
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={open}>
            {open ? "Hide" : "Students"} {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns} className="bg-muted/30 p-3">
            <SectionStudents s={s} o={o} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const TODAY_STYLE: Record<string, string> = {
  Present: "text-emerald-700",
  Late: "text-amber-700",
  "Half day": "text-amber-700",
  Absent: "text-destructive font-medium",
  Leave: "text-primary",
  "Not marked": "text-muted-foreground",
};

function SectionStudents({ s, o }: { s: SectionRow; o: Overview }) {
  const { selected } = useYear();
  const list = useQuery({
    queryKey: ["reports", "classes-overview", selected?.id, "section", s.sectionId],
    queryFn: () => api<Schemas["SectionStudent"][]>(`/reports/classes-overview/sections/${s.sectionId}/students`),
  });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const rows = list.data;
  const phones = rows.some((r) => r.fatherPhone);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {s.className} - {s.sectionName}: {rows.length} {rows.length === 1 ? "student" : "students"}
        </p>
        <div className="flex flex-wrap gap-2">
          <ClassListDownload sectionId={s.sectionId} />
          <Button variant="outline" size="sm" render={<Link href={`/app/attendance`} />}>
            Take attendance
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty title="No students in this section" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GR no.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Father</TableHead>
                {phones && <TableHead>Mobile</TableHead>}
                {o.today && <TableHead>Today</TableHead>}
                {o.fees && <TableHead className="text-right">Fees due</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{r.grNo}</TableCell>
                  <TableCell>
                    <Link href={`/app/students/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.gender === "FEMALE" ? "Girl" : "Boy"}</TableCell>
                  <TableCell>{r.fatherName ?? "—"}</TableCell>
                  {phones && <TableCell className="tabular-nums">{r.fatherPhone ?? "—"}</TableCell>}
                  {o.today && <TableCell className={TODAY_STYLE[r.today ?? ""] ?? ""}>{r.today}</TableCell>}
                  {o.fees && (
                    <TableCell className={"text-right tabular-nums" + (Number(r.feesOutstanding ?? 0) > 0 ? " font-semibold" : "")}>
                      {formatMoney(r.feesOutstanding)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
