"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { attendance, STATUSES, type StaffDay } from "@/lib/api/attendance";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Daily staff attendance with arrival times (FR 13.9, 13.10) and the monthly summary for payroll (FR 13.11). */
export function StaffAttendancePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff attendance" description="Enter arrival times; anyone after their category's late time is marked late." />
      <Tabs defaultValue="day">
        <TabsList>
          <TabsTrigger value="day">Daily</TabsTrigger>
          <TabsTrigger value="month">Monthly summary</TabsTrigger>
        </TabsList>
        <TabsContent value="day" className="mt-4"><Day /></TabsContent>
        <TabsContent value="month" className="mt-4"><Month /></TabsContent>
      </Tabs>
    </div>
  );
}

type Row = { status: string; arrival: string; note: string };

function Day() {
  const [date, setDate] = useState(today);
  const day = useQuery({ queryKey: ["attendance", "staff-day", date], queryFn: () => attendance.staffDay(date) });
  return (
    <div className="flex flex-col gap-4">
      <Field id="sd-date" label="Date" className="max-w-xs">
        <Input id="sd-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {day.isPending ? <Loading /> : day.isError ? <ErrorState error={day.error} /> : <DaySheet key={day.dataUpdatedAt} day={day.data} />}
    </div>
  );
}

function DaySheet({ day }: { day: StaffDay }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries((day.rows ?? []).map((r) => [r.staffId ?? 0, { status: r.status ?? "", arrival: (r.arrivalTime ?? "").slice(0, 5), note: r.note ?? "" }])),
  );
  const [reason, setReason] = useState("");
  const editable = can(P.ATTENDANCE_STAFF_MARK);
  const earlier = (day.date ?? "") < today();
  const save = useMutation({
    mutationFn: () =>
      attendance.saveStaffDay(day.date ?? "", {
        marks: (day.rows ?? [])
          .filter((r) => !r.monthApproved && rows[r.staffId ?? 0]?.status)
          .map((r) => {
            const v = rows[r.staffId ?? 0];
            return { staffId: r.staffId ?? 0, status: v.status, arrivalTime: v.arrival ? `${v.arrival}:00` : undefined, note: v.note || undefined };
          }),
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Staff attendance saved");
    },
    onError,
  });
  const set = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  if ((day.rows ?? []).length === 0) return <Empty title="No staff employed on this day" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatDate(day.date)}</CardTitle>
        <CardDescription>
          Late after {day.teacherLateAfter?.slice(0, 5)} for teachers and {day.otherLateAfter?.slice(0, 5)} for other staff (Rules & settings).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!day.workingDay && (
          <Alert variant="destructive"><AlertDescription>The school is closed on this day; marking needs the correction permission and a reason.</AlertDescription></Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Arrived</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {day.rows?.map((r) => {
              const v = rows[r.staffId ?? 0];
              const locked = !editable || r.monthApproved;
              return (
                <TableRow key={r.staffId}>
                  <TableCell>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.employeeNo} · {r.category === "TEACHER" ? "Teacher" : "Other staff"}</span>
                    {r.onApprovedLeave && <span className="block text-xs text-violet-700">On approved leave</span>}
                    {r.monthApproved && <Badge variant="secondary">Month approved</Badge>}
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`Arrival time of ${r.name}`} type="time" className="w-28" disabled={locked} value={v.arrival}
                      onChange={(e) => set(r.staffId ?? 0, { arrival: e.target.value, status: v.status || "P" })} />
                  </TableCell>
                  <TableCell>
                    <NativeSelect aria-label={`Status of ${r.name}`} className="w-32" disabled={locked} value={v.status} onChange={(e) => set(r.staffId ?? 0, { status: e.target.value })}>
                      <option value="">Not marked</option>
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`Note for ${r.name}`} className="w-48" maxLength={300} disabled={locked} value={v.note} onChange={(e) => set(r.staffId ?? 0, { note: e.target.value })} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {editable && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {(earlier || !day.workingDay) && (
              <Field id="sd-reason" label="Reason (needed when changing an earlier day)">
                <Textarea id="sd-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            <div><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Month() {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [unmarkedAsPresent, setUnmarkedAsPresent] = useState(false);
  const [reopening, setReopening] = useState(false);
  const rows = useQuery({ queryKey: ["attendance", "staff-month", month], queryFn: () => attendance.staffMonth(month) });
  const approve = useMutation({
    mutationFn: () => guard(() => attendance.approveMonth({ month, unmarkedAsPresent })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Month approved; payroll will use these figures");
    },
    onError,
  });
  const reopen = useMutation({
    mutationFn: (reason: string) => guard(() => attendance.reopenMonth({ month, reason })),
    onSuccess: () => {
      setReopening(false);
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError,
  });
  const anyOpen = (rows.data ?? []).some((r) => !r.approved);
  const anyApproved = (rows.data ?? []).some((r) => r.approved);
  return (
    <div className="flex flex-col gap-4">
      <Field id="sm-month" label="Month" className="max-w-xs">
        <Input id="sm-month" type="month" max={today().slice(0, 7)} value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      {rows.isPending ? (
        <Loading />
      ) : rows.isError ? (
        <ErrorState error={rows.error} />
      ) : rows.data.length === 0 ? (
        <Empty title="No staff in this month" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Working days</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">Half</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Leave</TableHead>
                  <TableHead className="text-right">Not marked</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.data.map((r) => (
                  <TableRow key={r.staffId}>
                    <TableCell><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">{r.employeeNo}</span></TableCell>
                    <TableCell className="text-right">{r.workingDays}</TableCell>
                    <TableCell className="text-right">{r.present}</TableCell>
                    <TableCell className="text-right">{r.late}</TableCell>
                    <TableCell className="text-right">{r.halfDays}</TableCell>
                    <TableCell className="text-right">{r.absent}</TableCell>
                    <TableCell className="text-right">{r.leave}</TableCell>
                    <TableCell className={(r.unmarked ?? 0) > 0 ? "text-right text-amber-700" : "text-right"}>{r.unmarked}</TableCell>
                    <TableCell>{r.approved ? <Badge>Approved by {r.approvedBy}</Badge> : <Badge variant="outline">Open</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {can(P.ATTENDANCE_STAFF_APPROVE) && (
        <div className="flex flex-wrap items-center gap-3">
          {anyOpen && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={unmarkedAsPresent} onCheckedChange={(c) => setUnmarkedAsPresent(c === true)} /> Count days not marked as present
              </label>
              <Button disabled={approve.isPending} onClick={() => approve.mutate()}>Approve month for payroll</Button>
            </>
          )}
          {anyApproved && <Button variant="outline" onClick={() => setReopening(true)}>Reopen month</Button>}
        </div>
      )}
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title={`Reopen ${month}?`}
        description="Attendance for the month can then be changed. Not possible once salaries for the month are approved."
        confirmLabel="Reopen"
        requireReason
        pending={reopen.isPending}
        onConfirm={(reason) => reopen.mutate(reason)}
      />
    </div>
  );
}
