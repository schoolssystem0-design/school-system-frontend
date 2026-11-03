"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, openBlob } from "@/lib/api/client";
import { fees, METHODS, type Adjustment } from "@/lib/api/fees";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fromPaisa, toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { Pager, today, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";
import { Balance, RequestStatus } from "./fee-shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const methodLabel = (m?: string) => METHODS.find((x) => x.value === m)?.label ?? m;

/** Recent payments with full traceability (FR 10.17, 10.18) and corrections waiting for approval (FR 10.13). */
export function PaymentsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const openId = Number(params.get("open")) || null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments & corrections" description="Payments are never edited; a mistake is reversed with a reason." />
      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-4">
          <PaymentList onOpen={(id) => router.replace(`/app/fees/payments?open=${id}`)} />
        </TabsContent>
        <TabsContent value="corrections" className="mt-4">
          <Corrections />
        </TabsContent>
      </Tabs>
      {openId && <PaymentDialog id={openId} onClose={() => router.replace("/app/fees/payments")} />}
    </div>
  );
}

function PaymentList({ onOpen }: { onOpen: (id: number) => void }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const params = { from, to, method, q, page };
  const list = useQuery({ queryKey: ["fees", "payments", params], queryFn: () => fees.payments(params) });
  const total = (list.data?.items ?? []).reduce((sum, p) => sum + toPaisa(p.amount), 0n);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="pay-from" label="From">
          <Input id="pay-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </Field>
        <Field id="pay-to" label="To">
          <Input id="pay-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </Field>
        <Field id="pay-method-filter" label="Paid by">
          <NativeSelect id="pay-method-filter" className="w-40" value={method} onChange={(e) => { setMethod(e.target.value); setPage(0); }}>
            <option value="">All</option>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="pay-q" label="Search">
          <Input id="pay-q" className="w-56" placeholder="Receipt, family no., father" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No payments in these dates" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Into</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Received by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => onOpen(p.id ?? 0)}>
                        {p.receiptNo ?? "Reversal"}
                      </button>
                      {p.reversed && <Badge variant="secondary" className="ms-2">Reversed</Badge>}
                    </TableCell>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>
                      {p.familyNo} <span className="text-muted-foreground">{p.fatherName}</span>
                    </TableCell>
                    <TableCell>{methodLabel(p.method)}</TableCell>
                    <TableCell>{p.accountName}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.amount)}</TableCell>
                    <TableCell>{p.receivedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {list.data && list.data.items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {list.data.totalItems} entries. Total on this page {formatMoney(fromPaisa(total))}
        </p>
      )}
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
    </div>
  );
}

function PaymentDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const payment = useQuery({ queryKey: ["fees", "payment", id], queryFn: () => fees.payment(id) });
  const [reversing, setReversing] = useState(false);
  const receipt = useMutation({
    mutationFn: () => fees.receipt(id),
    onSuccess: (b) => openBlob(b, "receipt.pdf"),
    onError,
  });
  const reverse = useMutation({
    mutationFn: (reason: string) => guard(() => fees.reverse(id, reason)),
    onSuccess: () => {
      setReversing(false);
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success("Payment reversed");
    },
    onError,
  });
  const p = payment.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{p?.receiptNo ? `Receipt ${p.receiptNo}` : "Reversal"}</DialogTitle>
          {p && (
            <DialogDescription>
              {formatMoney(p.amount)} on {formatDate(p.paymentDate)} from family {p.familyNo} ({p.fatherName})
            </DialogDescription>
          )}
        </DialogHeader>
        {payment.isPending ? (
          <Loading />
        ) : payment.isError ? (
          <ErrorState error={payment.error} />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted-foreground">Paid by</dt>
              <dd>
                {methodLabel(p?.method)}
                {p?.reference && ` · ${p.reference}`}
              </dd>
              <dt className="text-muted-foreground">Received into</dt>
              <dd>{p?.accountName}</dd>
              <dt className="text-muted-foreground">Received by</dt>
              <dd>
                {p?.receivedBy} · {formatDateTime(p?.createdAt)}
              </dd>
              {p?.studentName && (
                <>
                  <dt className="text-muted-foreground">Only for</dt>
                  <dd>{p.studentName}</dd>
                </>
              )}
              {p?.remarks && (
                <>
                  <dt className="text-muted-foreground">Remarks</dt>
                  <dd>{p.remarks}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Advance left</dt>
              <dd>{formatMoney(p?.creditRemaining)}</dd>
              <dt className="text-muted-foreground">Family balance now</dt>
              <dd>
                <Balance value={p?.familyBalance} />
              </dd>
              <dt className="text-muted-foreground">Journal entry</dt>
              <dd>#{p?.journalEntryId}</dd>
              {p?.reversalReason && (
                <>
                  <dt className="text-muted-foreground">Reversal reason</dt>
                  <dd>{p.reversalReason}</dd>
                </>
              )}
            </dl>
            {p?.reversedByPaymentId && <Badge variant="secondary">This payment was reversed</Badge>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>How</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(p?.allocations ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Not used for any fee yet (held as advance)
                    </TableCell>
                  </TableRow>
                ) : (
                  p?.allocations?.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {a.studentName} <span className="text-xs text-muted-foreground">GR {a.grNo}</span>
                      </TableCell>
                      <TableCell>
                        {a.description} <span className="text-xs text-muted-foreground">{a.billNo}</span>
                      </TableCell>
                      <TableCell>
                        {a.kind === "CREDIT" ? "From advance" : a.kind === "REVERSAL" ? "Reversed" : a.kind === "RELEASE" ? "Moved to advance" : "Paid"}
                      </TableCell>
                      <TableCell>{formatDate(a.date)}</TableCell>
                      <TableCell className="text-right">{formatMoney(a.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2">
              {p?.receiptNo && (
                <Button variant="outline" disabled={receipt.isPending} onClick={() => receipt.mutate()}>
                  <FileDown aria-hidden /> Receipt
                </Button>
              )}
              {can(P.FEES_PAYMENT_REVERSE) && p?.receiptNo && !p.reversedByPaymentId && (
                <Button variant="destructive" onClick={() => setReversing(true)}>
                  Reverse payment
                </Button>
              )}
            </div>
          </div>
        )}
        <ConfirmDialog
          open={reversing}
          onOpenChange={setReversing}
          title={`Reverse receipt ${p?.receiptNo}?`}
          description="Use this for a bounced cheque or a wrong entry. The receipt stays on record and a reversal is added; the fees it paid become due again."
          confirmLabel="Reverse"
          destructive
          requireReason
          pending={reverse.isPending}
          onConfirm={(reason) => reverse.mutate(reason)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Corrections() {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const list = useQuery({ queryKey: ["fees", "adjustments", status], queryFn: () => fees.adjustments({ status }) });
  const [rejecting, setRejecting] = useState<Adjustment | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["fees"] });
  const approve = useMutation({
    mutationFn: (id: number) => guard(() => fees.approveAdjustment(id)),
    onSuccess: () => {
      void refresh();
      toast.success("Correction approved");
    },
    onError,
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => fees.rejectAdjustment(id, note),
    onSuccess: () => {
      setRejecting(null);
      void refresh();
    },
    onError,
  });
  const approver = can(P.FEES_ADJUST_APPROVE);
  return (
    <div className="flex flex-col gap-4">
      <Field id="adj-status" label="Show" className="max-w-xs">
        <NativeSelect id="adj-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">Waiting for approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </NativeSelect>
      </Field>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No corrections" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  {approver && status === "PENDING" && <TableHead><span className="sr-only">Decide</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.studentName} <span className="text-xs text-muted-foreground">GR {a.grNo}</span>
                    </TableCell>
                    <TableCell>
                      {a.description} <span className="text-xs text-muted-foreground">charged {formatMoney(a.lineNet)}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(a.amount)}</TableCell>
                    <TableCell className="max-w-56">
                      <Badge variant="outline" className="me-1">
                        {a.kind === "BAD_DEBT" ? "Bad debt" : a.kind === "WAIVER" ? "Waiver" : "Correction"}
                      </Badge>
                      {a.reason}
                    </TableCell>
                    <TableCell>
                      {a.requestedBy} <span className="block text-xs text-muted-foreground">{formatDateTime(a.requestedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <RequestStatus status={a.status} />
                      {a.decidedBy && <span className="block text-xs text-muted-foreground">by {a.decidedBy}</span>}
                    </TableCell>
                    {approver && status === "PENDING" && (
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(a.id ?? 0)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejecting(a)}>
                          Reject
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={rejecting != null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject the correction?"
        confirmLabel="Reject"
        destructive
        requireReason
        pending={reject.isPending}
        onConfirm={(note) => rejecting && reject.mutate({ id: rejecting.id ?? 0, note })}
      />
    </div>
  );
}
