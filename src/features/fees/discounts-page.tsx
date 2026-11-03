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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { fees, type Discount } from "@/lib/api/fees";
import type { StudentRow } from "@/lib/api/people";
import { formatDate, formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { RequestStatus, StudentPicker } from "./fee-shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

/**
 * Discounts, scholarships and concessions (FR 10.3). Those above the school's no-approval limit wait for the
 * principal; only approved discounts reach new bills.
 */
export function DiscountsPage({ studentId }: { studentId?: number } = {}) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(studentId ? "" : "PENDING");
  const list = useQuery({ queryKey: ["fees", "discounts", status, studentId], queryFn: () => fees.discounts({ status, studentId }) });
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState<Discount | null>(null);
  const [ending, setEnding] = useState<Discount | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["fees", "discounts"] });
  const approve = useMutation({
    mutationFn: (id: number) => fees.approveDiscount(id),
    onSuccess: () => {
      void refresh();
      toast.success("Discount approved");
    },
    onError,
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => fees.rejectDiscount(id, note),
    onSuccess: () => {
      setRejecting(null);
      void refresh();
    },
    onError,
  });
  const end = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => fees.endDiscount(id, reason),
    onSuccess: () => {
      setEnding(null);
      void refresh();
      toast.success("Discount ended; bills already made keep it");
    },
    onError,
  });
  const approver = can(P.FEES_DISCOUNT_APPROVE);
  const manage = can(P.FEES_DISCOUNT_MANAGE);
  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field id="disc-status" label="Show">
          <NativeSelect id="disc-status" className="w-52" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">Waiting for approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ENDED">Ended</option>
            <option value="">All</option>
          </NativeSelect>
        </Field>
        {manage && (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Give discount
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No discounts" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>On</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>From – to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.studentName} <span className="text-xs text-muted-foreground">GR {d.grNo} · {d.className}</span>
                    </TableCell>
                    <TableCell>{d.headName ?? "All fees"}</TableCell>
                    <TableCell className="text-right">{d.kind === "PERCENT" ? `${d.value}%` : formatMoney(d.value)}</TableCell>
                    <TableCell className="max-w-56">
                      {d.reason}
                      <span className="block text-xs text-muted-foreground">by {d.requestedBy}</span>
                    </TableCell>
                    <TableCell>
                      {formatDate(d.validFrom)} – {d.validTo ? formatDate(d.validTo) : "open"}
                    </TableCell>
                    <TableCell>
                      <RequestStatus status={d.status} />
                      {d.decidedBy && d.status !== "PENDING" && <span className="block text-xs text-muted-foreground">by {d.decidedBy}</span>}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {approver && d.status === "PENDING" && (
                        <>
                          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(d.id ?? 0)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(d)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {manage && (d.status === "APPROVED" || d.status === "PENDING") && (
                        <Button size="sm" variant="ghost" onClick={() => setEnding(d)}>
                          End
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {adding && <DiscountDialog fixedStudentId={studentId} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={rejecting != null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject the discount?"
        confirmLabel="Reject"
        destructive
        requireReason
        pending={reject.isPending}
        onConfirm={(note) => rejecting && reject.mutate({ id: rejecting.id ?? 0, note })}
      />
      <ConfirmDialog
        open={ending != null}
        onOpenChange={(o) => !o && setEnding(null)}
        title="End this discount today?"
        description="Bills already made keep the discount; new bills do not get it."
        confirmLabel="End discount"
        requireReason
        pending={end.isPending}
        onConfirm={(reason) => ending && end.mutate({ id: ending.id ?? 0, reason })}
      />
    </div>
  );
  if (studentId) return content;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Discounts" description="Staff children, scholarships and other concessions." />
      {content}
    </div>
  );
}

function DiscountDialog({ fixedStudentId, onClose }: { fixedStudentId?: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const heads = useQuery({ queryKey: ["fees", "heads"], queryFn: fees.heads });
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [feeHeadId, setFeeHeadId] = useState<number | "">("");
  const [kind, setKind] = useState("PERCENT");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [validFrom, setValidFrom] = useState(today);
  const [validTo, setValidTo] = useState("");
  const studentId = fixedStudentId ?? student?.id;
  const save = useMutation({
    mutationFn: () =>
      fees.createDiscount({
        studentId: studentId ?? 0,
        feeHeadId: feeHeadId === "" ? undefined : feeHeadId,
        kind,
        value,
        reason,
        validFrom,
        validTo: validTo || undefined,
      }),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ["fees", "discounts"] });
      toast.success(d.status === "PENDING" ? "Discount saved; it waits for approval" : "Discount saved");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Give discount</DialogTitle>
            <DialogDescription>Applies to bills made from the start date. Large discounts need approval.</DialogDescription>
          </DialogHeader>
          {!fixedStudentId && <StudentPicker id="disc-student" selected={student} onSelect={setStudent} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="disc-head" label="On fee">
              <NativeSelect id="disc-head" value={feeHeadId} onChange={(e) => setFeeHeadId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">All fees</option>
                {(heads.data ?? [])
                  .filter((h) => !h.systemCode)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field id="disc-kind" label="Type">
              <NativeSelect id="disc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="PERCENT">Percentage</option>
                <option value="AMOUNT">Fixed amount (Rs.)</option>
              </NativeSelect>
            </Field>
            <Field id="disc-value" label={kind === "PERCENT" ? "Percentage" : "Amount (Rs.)"}>
              <Input id="disc-value" required inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field id="disc-reason" label="Reason" hint="e.g. Staff child, Scholarship">
              <Input id="disc-reason" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field id="disc-from" label="From">
              <Input id="disc-from" type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </Field>
            <Field id="disc-to" label="Until (optional)">
              <Input id="disc-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!studentId || !isAmount(value) || !reason.trim() || save.isPending}>
              {save.isPending ? "Saving…" : "Save discount"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
