"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, openBlob, type Schemas } from "@/lib/api/client";
import { attendance, STATUSES } from "@/lib/api/attendance";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { ClassSelect, SectionSelect, today, useCan } from "@/features/people/shared";
import { ExportBar } from "@/features/reports/export-bar";

const onError = (e: unknown) => toast.error(errorMessage(e));

const statusLabel = (s?: string) => STATUSES.find((x) => x.value === s)?.label ?? s ?? "—";

/** Attendance percentages and lists (FR 13.4–13.7), class summaries, corrections (FR 13.3). */
export function AttendanceReportsPage() {
  const can = useCan();
  const [sectionId, setSectionId] = useState<number | "">("");
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const params = { sectionId: sectionId || undefined, from, to };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance reports"
        description="Attendance % = (present + late + ½ half days) ÷ (marked school days − leave). Days the school is closed never count."
      />
      <ExportBar title="Attendance reports" />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ar-section" label="Section">
          <SectionSelect id="ar-section" className="w-48" emptyLabel="Whole school" value={sectionId} onChange={setSectionId} />
        </Field>
        <Field id="ar-from" label="From"><Input id="ar-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="ar-to" label="To"><Input id="ar-to" type="date" max={today()} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        {sectionId !== "" && <MonthlyRegisterButton sectionId={sectionId} month={from.slice(0, 7)} />}
      </div>
      <Tabs defaultValue="students">
        <TabsList className="flex-wrap">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="low">Low attendance</TabsTrigger>
          <TabsTrigger value="full">Full attendance</TabsTrigger>
          {can(P.ATTENDANCE_CORRECT) && <TabsTrigger value="sections">Class summary</TabsTrigger>}
          {can(P.ATTENDANCE_CORRECT) && <TabsTrigger value="corrections">Corrections</TabsTrigger>}
        </TabsList>
        <TabsContent value="students" className="mt-4"><Figures queryKey="students" load={() => attendance.figures(params)} params={params} /></TabsContent>
        <TabsContent value="low" className="mt-4"><Figures queryKey="low" load={() => attendance.low(params)} params={params} empty="No student is below the school's limit" /></TabsContent>
        <TabsContent value="full" className="mt-4"><Figures queryKey="full" load={() => attendance.full(params)} params={params} empty="No student was present every day" /></TabsContent>
        {can(P.ATTENDANCE_CORRECT) && (
          <TabsContent value="sections" className="mt-4"><Sections from={from} to={to} /></TabsContent>
        )}
        {can(P.ATTENDANCE_CORRECT) && (
          <TabsContent value="corrections" className="mt-4 flex flex-col gap-6">
            <Bulk />
            <Corrections from={from} to={to} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MonthlyRegisterButton({ sectionId, month }: { sectionId: number; month: string }) {
  const pdf = useMutation({
    mutationFn: () => attendance.monthly(sectionId, month),
    onSuccess: (b) => openBlob(b, `attendance-register-${month}.pdf`),
    onError,
  });
  return (
    <Button variant="outline" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
      <FileDown aria-hidden /> Monthly register ({month})
    </Button>
  );
}

function Figures({
  queryKey,
  load,
  params,
  empty = "Nothing marked in these dates",
}: {
  queryKey: string;
  load: () => Promise<Schemas["StudentFigures"][]>;
  params: object;
  empty?: string;
}) {
  const q = useQuery({ queryKey: ["attendance", "figures", queryKey, params], queryFn: load });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title={empty} />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Days marked</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Half</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Leave</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((f) => (
              <TableRow key={f.studentId}>
                <TableCell>
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/app/students/${f.studentId}`}>{f.name}</Link>{" "}
                  <span className="text-xs text-muted-foreground">GR {f.grNo}</span>
                </TableCell>
                <TableCell>{f.sectionLabel}</TableCell>
                <TableCell className="text-right">{f.markedDays}</TableCell>
                <TableCell className="text-right">{f.present}</TableCell>
                <TableCell className="text-right">{f.late}</TableCell>
                <TableCell className="text-right">{f.halfDays}</TableCell>
                <TableCell className="text-right">{f.absent}</TableCell>
                <TableCell className="text-right">{f.leave}</TableCell>
                <TableCell className="text-right font-medium">{f.percent ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Sections({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ["attendance", "sections", from, to], queryFn: () => attendance.sections(from, to) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title="Nothing marked in these dates" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Registers taken</TableHead>
              <TableHead className="text-right">Absences</TableHead>
              <TableHead className="text-right">Average %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((s) => (
              <TableRow key={s.sectionId}>
                <TableCell className="font-medium">{s.sectionLabel}</TableCell>
                <TableCell className="text-right">{s.students}</TableCell>
                <TableCell className="text-right">{s.registersTaken} / {s.workingDays}</TableCell>
                <TableCell className="text-right">{s.absences}</TableCell>
                <TableCell className="text-right">{s.averagePercent ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Bulk() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [fromStatus, setFromStatus] = useState("A");
  const [toStatus, setToStatus] = useState("P");
  const [fillUnmarked, setFillUnmarked] = useState(false);
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () =>
      attendance.bulk({
        from,
        to,
        classId: sectionId === "" && classId !== "" ? classId : undefined,
        sectionId: sectionId === "" ? undefined : sectionId,
        fromStatus: fromStatus || undefined,
        toStatus,
        fillUnmarked,
        reason,
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(`${r.changed} changed and ${r.created} added over ${r.days} school days`);
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change many registers at once</CardTitle>
        <CardDescription>
          E.g. a school trip: absent → present for a class over two days. For an unplanned holiday, add the day off under School setup →
          Academic years instead; those days then never count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run.mutate(); }}>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="bk-from" label="From"><Input id="bk-from" type="date" max={today()} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field id="bk-to" label="To"><Input id="bk-to" type="date" max={today()} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field id="bk-class" label="Class"><ClassSelect id="bk-class" className="w-36" emptyLabel="Whole school" value={classId} onChange={(v) => { setClassId(v); setSectionId(""); }} /></Field>
            <Field id="bk-section" label="Section"><SectionSelect id="bk-section" className="w-40" classId={classId} emptyLabel="All sections" value={sectionId} onChange={setSectionId} /></Field>
            <Field id="bk-fromst" label="Change">
              <NativeSelect id="bk-fromst" className="w-32" value={fromStatus} onChange={(e) => setFromStatus(e.target.value)}>
                <option value="">Any status</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </Field>
            <Field id="bk-tost" label="To">
              <NativeSelect id="bk-tost" className="w-32" value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={fillUnmarked} onCheckedChange={(c) => setFillUnmarked(c === true)} /> Also fill registers not taken
          </label>
          <Field id="bk-reason" label="Reason">
            <Textarea id="bk-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div><Button type="submit" disabled={!reason.trim() || to < from || run.isPending}>Apply</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Corrections({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ["attendance", "corrections", from, to], queryFn: () => attendance.corrections({ from, to }) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title="No corrections in these dates" />;
  return (
    <Card>
      <CardHeader><CardTitle>Change history</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{formatDate(c.date)}</TableCell>
                <TableCell>{c.personName} <span className="text-xs text-muted-foreground">{c.personType === "STAFF" ? "Staff" : "Student"}</span></TableCell>
                <TableCell>{statusLabel(c.oldStatus)} → {statusLabel(c.newStatus)}</TableCell>
                <TableCell className="max-w-64">{c.reason}</TableCell>
                <TableCell>{c.correctedBy} <span className="block text-xs text-muted-foreground">{formatDateTime(c.correctedAt)}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Month-by-month attendance on a student's profile. */
export function StudentAttendance({ studentId }: { studentId: number }) {
  const [from] = useState(() => `${Number(today().slice(0, 4)) - (Number(today().slice(5, 7)) < 4 ? 1 : 0)}-04-01`);
  const q = useQuery({ queryKey: ["attendance", "student-months", studentId, from], queryFn: () => attendance.studentMonths(studentId, from, today()) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>From {formatDate(from)}. Leave days are not counted against the student.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">School days</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Half</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Leave</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((m) => (
              <TableRow key={m.month}>
                <TableCell>{m.month}</TableCell>
                <TableCell className="text-right">{m.workingDays}</TableCell>
                <TableCell className="text-right">{m.present}</TableCell>
                <TableCell className="text-right">{m.late}</TableCell>
                <TableCell className="text-right">{m.halfDays}</TableCell>
                <TableCell className="text-right">{m.absent}</TableCell>
                <TableCell className="text-right">{m.leave}</TableCell>
                <TableCell className="text-right font-medium">{m.percent ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
