"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiBlob, errorMessage, openBlob, type Schemas } from "@/lib/api/client";
import { P, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { StudentPicker } from "@/features/fees/fee-shared";
import { ClassSelect, SectionSelect, today, useCan } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";
import { staff as staffApi } from "@/lib/api/people";
import { XLSX_TYPE } from "./export-bar";

const onError = (e: unknown) => toast.error(errorMessage(e));

type ReportDoc = Schemas["ReportDoc"];
type Period = { from: string; to: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday to Sunday of the week holding a date. */
function weekOf(date: string): Period {
  const d = new Date(`${date}T00:00:00`);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: iso(monday), to: iso(sunday) };
}

function monthOf(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: iso(new Date(y, m, 0)) };
}

/** Week, month or custom dates (FR 15.1), kept inside the selected academic year. */
function usePeriod() {
  const { selected } = useYear();
  const [kind, setKind] = useState<"week" | "month" | "custom">("month");
  const [week, setWeek] = useState(today);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const raw = kind === "week" ? weekOf(week) : kind === "month" ? monthOf(month) : { from, to };
  const clamp = (d: string) => {
    if (selected?.startDate && d < selected.startDate) return selected.startDate;
    if (selected?.endDate && d > selected.endDate) return selected.endDate;
    return d;
  };
  const period = kind === "custom" ? raw : { from: clamp(raw.from), to: clamp(raw.to) };
  const controls = (
    <>
      <Field id="rp-kind" label="Period">
        <NativeSelect id="rp-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="custom">Custom dates</option>
        </NativeSelect>
      </Field>
      {kind === "week" && <Field id="rp-week" label="Any day in the week"><Input id="rp-week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></Field>}
      {kind === "month" && <Field id="rp-month" label="Month"><Input id="rp-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
      {kind === "custom" && (
        <>
          <Field id="rp-from" label="From"><Input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field id="rp-to" label="To"><Input id="rp-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </>
      )}
    </>
  );
  return { period, controls, ready: Boolean(period.from && period.to) };
}

/** The same report object is drawn here, in the PDF and in Excel, so the values match. */
function ReportView({ path, params, name }: { path: string; params: Record<string, string>; name: string }) {
  const search = new URLSearchParams(params).toString();
  const doc = useQuery({
    queryKey: ["reports", path, search],
    queryFn: () => api<ReportDoc>(`/reports/${path}?${search}`),
    retry: false,
  });
  const file = useMutation({
    mutationFn: async (format: "pdf" | "xlsx") => {
      const blob = await apiBlob(`/reports/${path}/file?${search}&format=${format}`, {}, format === "pdf" ? "application/pdf" : XLSX_TYPE);
      openBlob(blob, `${name}.${format}`);
    },
    onError,
  });
  if (doc.isPending) return <Loading />;
  if (doc.isError) return <ErrorState error={doc.error} />;
  const d = doc.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{d.title}</h2>
          {(d.heading ?? []).map((line) => <p key={line} className="text-sm text-muted-foreground print:text-foreground">{line}</p>)}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Save this report">
          <Button variant="outline" size="sm" disabled={file.isPending} onClick={() => file.mutate("pdf")}><Download className="size-4" aria-hidden /> PDF</Button>
          <Button variant="outline" size="sm" disabled={file.isPending} onClick={() => file.mutate("xlsx")}><Download className="size-4" aria-hidden /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
        </div>
      </div>
      {(d.sections ?? []).map((s) => (
        <Card key={s.title}>
          <CardHeader>
            <CardTitle className="text-base">{s.title}</CardTitle>
            {s.note && <CardDescription>{s.note}</CardDescription>}
          </CardHeader>
          <CardContent>
            {(s.rows ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None in this period.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {(s.columns ?? []).map((c) => <TableHead key={c.name} className={cn(c.kind !== "TEXT" && "text-right")}>{c.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(s.rows ?? []).map((row, i) => (
                    <TableRow key={i}>
                      {(s.columns ?? []).map((c, j) => (
                        <TableCell key={c.name} className={cn(c.kind !== "TEXT" && "text-right tabular-nums")}>{row[j] ?? "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type StudentRow = Parameters<typeof StudentPicker>[0]["selected"];

function StudentReport() {
  const { period, controls, ready } = usePeriod();
  const [student, setStudent] = useState<StudentRow>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">{controls}</div>
      <div className="max-w-md print:hidden"><StudentPicker id="rp-student" selected={student} onSelect={setStudent} /></div>
      {student && ready ? (
        <ReportView path="student" name="student-report" params={{ studentId: String(student.id), ...period }} />
      ) : <Empty title="Choose a student" />}
    </div>
  );
}

function ClassReport() {
  const { period, controls, ready } = usePeriod();
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const target: Record<string, string> | null = sectionId !== "" ? { sectionId: String(sectionId) } : classId !== "" ? { classId: String(classId) } : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Field id="rp-class" label="Class">
          <ClassSelect id="rp-class" className="w-44" emptyLabel="Choose a class" value={classId} onChange={(v) => { setClassId(v); setSectionId(""); }} />
        </Field>
        <Field id="rp-section" label="Section">
          <SectionSelect id="rp-section" className="w-44" emptyLabel="Whole class or choose" classId={classId} value={sectionId} onChange={setSectionId} />
        </Field>
        {controls}
      </div>
      {target && ready ? (
        <ReportView path="class" name="class-report" params={{ ...target, ...period }} />
      ) : <Empty title="Choose a class or a section" />}
    </div>
  );
}

function TeacherReport() {
  const { period, controls, ready } = usePeriod();
  const [staffId, setStaffId] = useState<number | "">("");
  const list = useQuery({ queryKey: ["staff", "pick-all"], queryFn: () => staffApi.list({ status: "ACTIVE", size: 200 }) });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Field id="rp-staff" label="Teacher">
          <NativeSelect id="rp-staff" className="w-56" value={staffId} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Choose a teacher</option>
            {(list.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.employeeNo})</option>)}
          </NativeSelect>
        </Field>
        {controls}
      </div>
      {staffId !== "" && ready ? (
        <ReportView path="teacher" name="teacher-report" params={{ staffId: String(staffId), ...period }} />
      ) : <Empty title="Choose a teacher" />}
    </div>
  );
}

/** Where each detailed report lives (FR 15.5). */
const CATALOGUE: { group: string; items: { href: string; label: string; detail: string; permission: Permission }[] }[] = [
  {
    group: "Attendance",
    items: [
      { href: "/app/attendance/reports", label: "Attendance reports", detail: "Percentages, low and full attendance, class summaries, monthly registers", permission: P.ATTENDANCE_VIEW },
      { href: "/app/attendance", label: "Missing registers and absences in a row", detail: "Today's missing registers and repeated absences", permission: P.ATTENDANCE_VIEW },
      { href: "/app/attendance/staff", label: "Staff monthly attendance", detail: "Daily marks and the monthly summary for payroll", permission: P.ATTENDANCE_STAFF_MARK },
    ],
  },
  {
    group: "Marks",
    items: [{ href: "/app/marks", label: "Test marks and overall positions", detail: "Each test, and positions over any dates", permission: P.EXAMS_VIEW }],
  },
  {
    group: "Fees",
    items: [
      { href: "/app/fees/reports", label: "Fee reports", detail: "Billed and received by head, family balances, credits, write-offs", permission: P.FEES_REPORTS_VIEW },
      { href: "/app/fees/defaulters", label: "Fee status and defaulters", detail: "Who has paid, who owes, and follow-ups", permission: P.FEES_VIEW },
    ],
  },
  {
    group: "Accounts and salaries",
    items: [
      { href: "/app/accounts/reports", label: "Financial reports", detail: "Income and expense, balance sheet, trial balance, daily collection", permission: P.ACCOUNTS_REPORTS_VIEW },
      { href: "/app/accounts/day", label: "Day book", detail: "Each day's money in and out, and the day close", permission: P.ACCOUNTS_VIEW },
      { href: "/app/payroll", label: "Payroll", detail: "Salary sheets and slips", permission: P.PAYROLL_VIEW },
    ],
  },
];

function Catalogue() {
  const can = useCan();
  const groups = CATALOGUE.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter((g) => g.items.length > 0);
  if (groups.length === 0) return <Empty title="No detailed reports for your role" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.group}>
          <CardHeader><CardTitle className="text-base">{g.group}</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="font-medium underline-offset-4 hover:underline">{i.label}</Link>
                  <p className="text-muted-foreground">{i.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Weekly and monthly reports (FR 15) and the list of detailed reports. */
export function ReportsPage() {
  const can = useCan();
  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader title="Reports" description="Weekly and monthly summaries, compared with the period before. Each shows its dates and academic year." />
      </div>
      <Tabs defaultValue="student">
        <TabsList className="print:hidden">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="class">Class</TabsTrigger>
          {can(P.REPORTS_STAFF_VIEW) && <TabsTrigger value="teacher">Teacher</TabsTrigger>}
          <TabsTrigger value="all">All reports</TabsTrigger>
        </TabsList>
        <TabsContent value="student" className="mt-4"><StudentReport /></TabsContent>
        <TabsContent value="class" className="mt-4"><ClassReport /></TabsContent>
        <TabsContent value="teacher" className="mt-4"><TeacherReport /></TabsContent>
        <TabsContent value="all" className="mt-4"><Catalogue /></TabsContent>
      </Tabs>
    </div>
  );
}

/** The all-schools comparison for the super admin (P-9). */
export function SchoolsReport({ onOpen, opening }: { onOpen: (schoolId: number) => void; opening: boolean }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const search = new URLSearchParams({ from, to }).toString();
  const report = useQuery({
    queryKey: ["platform", "reports", search],
    queryFn: () => api<Schemas["CrossSchoolReport"]>(`/platform/reports/schools?${search}`),
    enabled: Boolean(from && to),
  });
  const file = useMutation({
    mutationFn: async (format: "pdf" | "xlsx") => {
      const blob = await apiBlob(`/platform/reports/schools/file?${search}&format=${format}`, {}, format === "pdf" ? "application/pdf" : XLSX_TYPE);
      openBlob(blob, `all-schools-report.${format}`);
    },
    onError,
  });
  const row = (s: Schemas["SchoolFigures"], total: boolean) => (
    <TableRow key={s.schoolId ?? "total"} className={cn(total && "font-semibold")}>
      <TableCell>{s.name}{!total && s.status !== "ACTIVE" && <span className="ml-2 text-xs text-muted-foreground">{s.status}</span>}</TableCell>
      <TableCell className="text-right tabular-nums">{s.students}</TableCell>
      <TableCell className="text-right tabular-nums">{s.attendancePercent ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{s.billed}</TableCell>
      <TableCell className="text-right tabular-nums">{s.collected}</TableCell>
      <TableCell className="text-right tabular-nums">{s.outstanding}</TableCell>
      <TableCell className="text-right tabular-nums">{s.defaulterFamilies}</TableCell>
      <TableCell className="text-right tabular-nums">{s.income}</TableCell>
      <TableCell className="text-right tabular-nums">{s.expense}</TableCell>
      <TableCell className="text-right tabular-nums">{s.testAverage ?? "—"}</TableCell>
      <TableCell className="print:hidden">
        {!total && <Button variant="outline" size="sm" aria-label={`Open ${s.name}`} disabled={opening} onClick={() => onOpen(s.schoolId ?? 0)}>Open</Button>}
      </TableCell>
    </TableRow>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="All-schools report" description="Compare every school for any dates. Open a school to see its own detailed reports." />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Field id="pr-from" label="From"><Input id="pr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="pr-to" label="To"><Input id="pr-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="outline" size="sm" disabled={file.isPending} onClick={() => file.mutate("xlsx")}><Download className="size-4" aria-hidden /> Excel</Button>
        <Button variant="outline" size="sm" disabled={file.isPending} onClick={() => file.mutate("pdf")}><Download className="size-4" aria-hidden /> PDF</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
      </div>
      {report.isPending ? <Loading /> : report.isError ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : (
        <>
          <p className="text-sm text-muted-foreground">
            Outstanding and defaulters are as of today; the rest are for these dates. Absent counts as 0 in the test average. Schools can differ in their academic years.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Attendance %</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Defaulter families</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Test average %</TableHead>
                <TableHead className="sr-only print:hidden">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.data.schools ?? []).map((s) => row(s, false))}
              {report.data.total && row(report.data.total, true)}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
