"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { attendance, STATUSES, type Register } from "@/lib/api/attendance";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { SectionSelect, today, useCan } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const STATUS_STYLE: Record<string, string> = {
  P: "bg-emerald-600 text-white",
  A: "bg-red-600 text-white",
  L: "bg-amber-500 text-white",
  HD: "bg-sky-600 text-white",
  LV: "bg-violet-600 text-white",
};

/** Daily class register (FR 13.1–13.3), missing registers (FR 13.2) and repeated absences (FR 13.6). */
export function RegisterPage() {
  const [sectionId, setSectionId] = useState<number | "">("");
  const [date, setDate] = useState(today);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Take attendance" description="Everyone is present unless you mark otherwise. Saving completes the register." />
      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="missing">Missing registers</TabsTrigger>
          <TabsTrigger value="repeated">Absent days in a row</TabsTrigger>
        </TabsList>
        <TabsContent value="register" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field id="reg-section" label="Section">
              <SectionSelect id="reg-section" className="w-48" value={sectionId} onChange={setSectionId} />
            </Field>
            <Field id="reg-date" label="Date">
              <Input id="reg-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {sectionId === "" ? (
            <Empty title="Choose a section" />
          ) : (
            <RegisterLoader key={`${sectionId}-${date}`} sectionId={sectionId} date={date} />
          )}
        </TabsContent>
        <TabsContent value="missing" className="mt-4">
          <Missing onOpen={(id, d) => { setSectionId(id); setDate(d); }} />
        </TabsContent>
        <TabsContent value="repeated" className="mt-4">
          <Repeated />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RegisterLoader({ sectionId, date }: { sectionId: number; date: string }) {
  const register = useQuery({ queryKey: ["attendance", "register", sectionId, date], queryFn: () => attendance.register(sectionId, date) });
  if (register.isPending) return <Loading />;
  if (register.isError) return <ErrorState error={register.error} onRetry={() => register.refetch()} />;
  return <RegisterGrid key={register.dataUpdatedAt} register={register.data} />;
}

function RegisterGrid({ register }: { register: Register }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const initial = Object.fromEntries((register.rows ?? []).map((r) => [r.studentId ?? 0, r.status ?? "P"]));
  const [statuses, setStatuses] = useState<Record<number, string>>(initial);
  const [reason, setReason] = useState("");
  const changedSaved = (register.rows ?? []).some((r) => r.saved && statuses[r.studentId ?? 0] !== r.status);
  const earlier = register.date !== undefined && register.date < today();
  const needsReason = !register.workingDay || (earlier && changedSaved);
  const save = useMutation({
    mutationFn: () =>
      attendance.saveRegister(register.sectionId ?? 0, register.date ?? "", {
        marks: (register.rows ?? []).map((r) => ({ studentId: r.studentId ?? 0, status: statuses[r.studentId ?? 0] })),
        reason: reason.trim() || undefined,
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(`Register saved: ${r.totals?.A ?? 0} absent, ${r.totals?.L ?? 0} late`);
    },
    onError,
  });
  const rows = register.rows ?? [];
  const counts = STATUSES.map((s) => ({ ...s, n: rows.filter((r) => statuses[r.studentId ?? 0] === s.value).length }));
  if (rows.length === 0) return <Empty title="No students in this section on this day" />;
  const editable = register.canMark;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{register.sectionLabel} · {formatDate(register.date)}</CardTitle>
          <CardDescription>
            {register.completed ? `Taken by ${register.completedBy} at ${formatDateTime(register.completedAt)}` : "Not taken yet"} ·{" "}
            {counts.map((c) => `${c.label} ${c.n}`).join(", ")}
          </CardDescription>
        </div>
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setStatuses(Object.fromEntries(rows.map((r) => [r.studentId ?? 0, r.onApprovedLeave ? "LV" : "P"])))}>
            Mark all present
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!register.workingDay && (
          <Alert variant="destructive">
            <AlertTitle>The school is closed on this day</AlertTitle>
            <AlertDescription>Marking it needs the correction permission and a reason.</AlertDescription>
          </Alert>
        )}
        {!editable && (
          <Alert>
            <AlertDescription>You can view this register. Only the class teacher or the office can take it.</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const current = statuses[r.studentId ?? 0];
              return (
                <TableRow key={r.studentId}>
                  <TableCell>{r.rollNo ?? "—"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">GR {r.grNo}</span>
                    {r.onApprovedLeave && <span className="block text-xs text-violet-700">On approved leave</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Attendance for ${r.name}`}>
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          role="radio"
                          aria-checked={current === s.value}
                          aria-label={s.label}
                          title={s.label}
                          disabled={!editable}
                          onClick={() => setStatuses((st) => ({ ...st, [r.studentId ?? 0]: s.value }))}
                          className={cn(
                            "h-8 min-w-9 rounded-md border px-2 text-xs font-semibold transition-colors disabled:opacity-60",
                            current === s.value ? STATUS_STYLE[s.value] : "bg-background hover:bg-muted",
                          )}
                        >
                          {s.short}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {editable && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {(needsReason || earlier) && (
              <Field
                id="reg-reason"
                label={needsReason ? "Reason (needed)" : "Reason (needed when changing an earlier day)"}
                hint={can(P.ATTENDANCE_CORRECT) ? undefined : "Changes to earlier days are made by the office"}
              >
                <Textarea id="reg-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            <div>
              <Button type="submit" disabled={save.isPending || (needsReason && !reason.trim())}>
                {save.isPending ? "Saving…" : register.completed ? "Save changes" : "Save register"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Missing({ onOpen }: { onOpen: (sectionId: number, date: string) => void }) {
  const [date, setDate] = useState(today);
  const list = useQuery({ queryKey: ["attendance", "missing", date], queryFn: () => attendance.missing(date) });
  return (
    <div className="flex flex-col gap-4">
      <Field id="miss-date" label="Date" className="max-w-xs">
        <Input id="miss-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data.length === 0 ? (
        <Empty title="Every register is taken (or the school is closed)" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Class teacher</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((m) => (
                  <TableRow key={m.sectionId}>
                    <TableCell className="font-medium">{m.sectionLabel}</TableCell>
                    <TableCell>{m.classTeacher ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.students}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => onOpen(m.sectionId ?? 0, date)}>Open register</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Repeated() {
  const list = useQuery({ queryKey: ["attendance", "repeated"], queryFn: () => attendance.repeated(today()) });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} />;
  if (list.data.length === 0) return <Empty title="No student is absent several days in a row" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Days in a row</TableHead>
              <TableHead>Since</TableHead>
              <TableHead>Father&apos;s phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell>
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/app/students/${r.studentId}`}>{r.name}</Link>{" "}
                  <span className="text-xs text-muted-foreground">GR {r.grNo}</span>
                </TableCell>
                <TableCell>{r.sectionLabel}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{r.daysInARow}</TableCell>
                <TableCell>{formatDate(r.since)}</TableCell>
                <TableCell>{r.fatherPhone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
