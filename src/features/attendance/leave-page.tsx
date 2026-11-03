"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { attendance, LEAVE_TYPES, type Leave } from "@/lib/api/attendance";
import { staff as staffApi, type StudentRow } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { StudentPicker } from "@/features/fees/fee-shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const STATUS: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
  PENDING: { label: "Waiting for approval", variant: "outline" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

/** Leave applications for students and staff, entered by the office (FR 13.8). */
export function LeavePage({ personType, personId }: { personType?: "STUDENT" | "STAFF"; personId?: number } = {}) {
  const can = useCan();
  const queryClient = useQueryClient();
  const embedded = personId != null;
  const [status, setStatus] = useState(embedded ? "" : "PENDING");
  const [type, setType] = useState(personType ?? "");
  const list = useQuery({
    queryKey: ["attendance", "leave", status, type, personId],
    queryFn: () => attendance.leave({ status, personType: type || undefined, personId }),
  });
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<{ leave: Leave; kind: "reject" | "cancel" } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["attendance"] });
  const approve = useMutation({
    mutationFn: (id: number) => attendance.approveLeave(id),
    onSuccess: () => {
      void refresh();
      toast.success("Leave approved; those days now show as leave");
    },
    onError,
  });
  const decide = useMutation({
    mutationFn: ({ id, kind, note }: { id: number; kind: "reject" | "cancel"; note: string }) =>
      kind === "reject" ? attendance.rejectLeave(id, note) : attendance.cancelLeave(id, note),
    onSuccess: () => {
      setAction(null);
      void refresh();
    },
    onError,
  });
  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="lv-status" label="Show">
            <NativeSelect id="lv-status" className="w-52" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">Waiting for approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="">All</option>
            </NativeSelect>
          </Field>
          {!embedded && (
            <Field id="lv-type" label="For">
              <NativeSelect id="lv-type" className="w-36" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Everyone</option>
                <option value="STUDENT">Students</option>
                <option value="STAFF">Staff</option>
              </NativeSelect>
            </Field>
          )}
        </div>
        {can(P.ATTENDANCE_LEAVE_MANAGE) && (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Enter leave
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} />
          ) : list.data.length === 0 ? (
            <div className="p-6"><Empty title="No leave" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Who</TableHead>
                  <TableHead>Leave</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-medium">{l.personName}</span>
                      <span className="block text-xs text-muted-foreground">{l.personType === "STUDENT" ? "Student" : "Staff"} · {l.detail}</span>
                    </TableCell>
                    <TableCell>{LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label}</TableCell>
                    <TableCell>
                      {formatDate(l.dateFrom)} – {formatDate(l.dateTo)}
                      <span className="block text-xs text-muted-foreground">{l.workingDays} school days</span>
                    </TableCell>
                    <TableCell className="max-w-56">{l.reason}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS[l.status ?? ""]?.variant ?? "outline"}>{STATUS[l.status ?? ""]?.label ?? l.status}</Badge>
                      {l.decidedBy && <span className="block text-xs text-muted-foreground">by {l.decidedBy}</span>}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {l.status === "PENDING" && can(P.ATTENDANCE_LEAVE_APPROVE) && (
                        <>
                          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(l.id ?? 0)}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setAction({ leave: l, kind: "reject" })}>Reject</Button>
                        </>
                      )}
                      {can(P.ATTENDANCE_LEAVE_MANAGE) && (l.status === "PENDING" || (l.status === "APPROVED" && (l.dateFrom ?? "") > today())) && (
                        <Button size="sm" variant="ghost" onClick={() => setAction({ leave: l, kind: "cancel" })}>Cancel</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {adding && <LeaveDialog personType={personType} personId={personId} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={action != null}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === "reject" ? "Reject this leave?" : "Cancel this leave?"}
        confirmLabel={action?.kind === "reject" ? "Reject" : "Cancel leave"}
        destructive
        requireReason
        pending={decide.isPending}
        onConfirm={(note) => action && decide.mutate({ id: action.leave.id ?? 0, kind: action.kind, note })}
      />
    </div>
  );
  if (embedded) return content;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leave" description="Approved leave shows as Leave on the registers and does not lower attendance %." />
      {content}
    </div>
  );
}

function LeaveDialog({ personType, personId, onClose }: { personType?: "STUDENT" | "STAFF"; personId?: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [who, setWho] = useState<"STUDENT" | "STAFF">(personType ?? "STUDENT");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [staffId, setStaffId] = useState<number | "">(personType === "STAFF" && personId ? personId : "");
  const [leaveType, setLeaveType] = useState("SICK");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [reason, setReason] = useState("");
  const staffList = useQuery({ queryKey: ["staff", "pick-all"], queryFn: () => staffApi.list({ status: "ACTIVE", size: 200 }), enabled: who === "STAFF" && personId == null });
  const studentId = personType === "STUDENT" && personId ? personId : student?.id;
  const save = useMutation({
    mutationFn: () =>
      attendance.createLeave({
        personType: who,
        studentId: who === "STUDENT" ? studentId : undefined,
        staffId: who === "STAFF" && staffId !== "" ? staffId : undefined,
        leaveType,
        dateFrom,
        dateTo,
        reason,
      }),
    onSuccess: (l) => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(l.status === "APPROVED" ? "Leave entered and approved" : "Leave entered; it waits for approval");
      onClose();
    },
    onError,
  });
  const ready = (who === "STUDENT" ? studentId != null : staffId !== "") && reason.trim() && dateTo >= dateFrom;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Enter leave</DialogTitle>
            <DialogDescription>From a parent&apos;s application or a staff request.</DialogDescription>
          </DialogHeader>
          {personId == null && (
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">For</legend>
              <label className="flex items-center gap-2"><input type="radio" name="lv-who" checked={who === "STUDENT"} onChange={() => setWho("STUDENT")} /> Student</label>
              <label className="flex items-center gap-2"><input type="radio" name="lv-who" checked={who === "STAFF"} onChange={() => setWho("STAFF")} /> Staff member</label>
            </fieldset>
          )}
          {personId == null && who === "STUDENT" && <StudentPicker id="lv-student" selected={student} onSelect={setStudent} />}
          {personId == null && who === "STAFF" && (
            <Field id="lv-staff" label="Staff member">
              <NativeSelect id="lv-staff" required value={staffId} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose</option>
                {(staffList.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.employeeNo})</option>)}
              </NativeSelect>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="lv-kind" label="Kind">
              <NativeSelect id="lv-kind" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field id="lv-from" label="First day"><Input id="lv-from" type="date" required value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
            <Field id="lv-to" label="Last day"><Input id="lv-to" type="date" required min={dateFrom} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          </div>
          <Field id="lv-reason" label="Reason">
            <Textarea id="lv-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || save.isPending}>{save.isPending ? "Saving…" : "Save leave"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
