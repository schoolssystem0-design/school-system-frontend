"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, openBlob } from "@/lib/api/client";
import { fees, METHODS, newKey, type OpenLine, type Payment } from "@/lib/api/fees";
import type { StudentRow } from "@/lib/api/people";
import { formatDate, formatMoney } from "@/lib/format";
import { allocateOldestFirst, fromPaisa, isAmount, sumPaisa, toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { Balance, StudentPicker } from "./fee-shared";

/**
 * Receive a fee payment (FR 10.7–10.10). One family can pay for all its children on one receipt. By default the
 * money settles the oldest dues first; the cashier may choose lines instead. Anything left over is kept as advance.
 */
export function CollectPage() {
  const params = useSearchParams();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const familyFromUrl = Number(params.get("familyId")) || null;
  const familyId = student?.familyId ?? familyFromUrl;
  const [done, setDone] = useState<Payment | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collect fees"
        description="Find the student; the payment is for the whole family unless you limit it to one child."
      />
      {done ? (
        <PaymentDone
          payment={done}
          onNext={() => {
            setDone(null);
            setStudent(null);
          }}
        />
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <StudentPicker id="collect-student" selected={student} onSelect={setStudent} />
            </CardContent>
          </Card>
          {familyId ? (
            <PaymentForm key={familyId} familyId={familyId} student={student} onDone={setDone} />
          ) : (
            <Empty title="Choose a student to see what the family owes" />
          )}
        </>
      )}
    </div>
  );
}

function PaymentForm({
  familyId,
  student,
  onDone,
}: {
  familyId: number;
  student: StudentRow | null;
  onDone: (p: Payment) => void;
}) {
  const queryClient = useQueryClient();
  const [onlyStudent, setOnlyStudent] = useState(false);
  const studentId = onlyStudent && student ? (student.id ?? undefined) : undefined;
  const ledger = useQuery({ queryKey: ["fees", "family-ledger", familyId], queryFn: () => fees.familyLedger(familyId) });
  const lines = useQuery({
    queryKey: ["fees", "open-lines", familyId, studentId],
    queryFn: () => fees.openLines(familyId, studentId),
  });
  const accounts = useQuery({ queryKey: ["fees", "accounts"], queryFn: fees.accounts });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [accountId, setAccountId] = useState<number | "">("");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manual, setManual] = useState(false);
  const [chosen, setChosen] = useState<Record<number, string>>({});

  const open = useMemo(() => lines.data ?? [], [lines.data]);
  const amountOk = isAmount(amount);
  const paisa = amountOk ? toPaisa(amount) : 0n;
  const auto = allocateOldestFirst(
    paisa,
    open.map((l) => toPaisa(l.balance)),
  );
  const allocation = open.map((l, i) => (manual ? (chosen[l.billLineId ?? 0] ?? "") : fromPaisa(auto[i])));
  const allocationOk = !manual || allocation.every((a, i) => a === "" || (isAmount(a, { allowZero: true }) && toPaisa(a) <= toPaisa(open[i].balance)));
  const allocated = allocationOk ? sumPaisa(allocation.map((a) => (a === "" ? "0" : a))) : 0n;
  const advance = paisa - allocated;
  const account = accountId === "" ? accounts.data?.find((a) => a.subtype === (method === "CASH" ? "CASH" : "BANK"))?.id : accountId;

  const payload = {
    familyId,
    studentId,
    amount: amountOk ? fromPaisa(paisa) : amount,
    method,
    accountId: account ?? 0,
    paymentDate: date,
    reference: reference.trim() || undefined,
    remarks: remarks.trim() || undefined,
    allocations: manual
      ? open
          .map((l, i) => ({ billLineId: l.billLineId ?? 0, amount: allocation[i] }))
          .filter((a) => a.amount !== "" && toPaisa(a.amount) > 0n)
      : undefined,
  };
  const payloadKey = JSON.stringify(payload);
  // One key per distinct payment attempt: a retry of the same attempt can never create a second payment.
  const idempotencyKey = useMemo(() => newKey(), [payloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = useMutation({
    mutationFn: () => fees.pay(payload, idempotencyKey),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      onDone(p);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (ledger.isPending || lines.isPending) return <Loading />;
  if (ledger.isError) return <ErrorState error={ledger.error} onRetry={() => ledger.refetch()} />;
  if (lines.isError) return <ErrorState error={lines.error} onRetry={() => lines.refetch()} />;
  const due = toPaisa(ledger.data.balance);
  const canSubmit = amountOk && allocationOk && advance >= 0n && account != null && !pay.isPending;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) pay.mutate();
      }}
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>What the family owes</CardTitle>
            <CardDescription>
              Total due <Balance value={ledger.data.owed} />
              {toPaisa(ledger.data.credit) > 0n && <> · advance held {formatMoney(ledger.data.credit)}</>}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href={`/app/families/${familyId}`} />}>
              Family and ledger
            </Button>
            {due > 0n && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAmount(fromPaisa(due))}>
                Pay all ({formatMoney(fromPaisa(due))})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {student && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyStudent} onChange={(e) => setOnlyStudent(e.target.checked)} />
              Only for {student.name} (the payment and any advance stay with this child)
            </label>
          )}
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is due. A payment now is kept as advance for future bills.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => {
                    setManual(e.target.checked);
                    if (e.target.checked) {
                      setChosen(Object.fromEntries(open.map((l, i) => [l.billLineId ?? 0, fromPaisa(auto[i])])));
                    }
                  }}
                />
                Choose which fees this payment settles (otherwise the oldest dues are settled first)
              </label>
              <OpenLinesTable lines={open} allocation={allocation} manual={manual} onChange={(id, v) => setChosen((c) => ({ ...c, [id]: v }))} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="pay-amount" label="Amount received (Rs.)" error={amount !== "" && !amountOk ? "Enter an amount like 3500 or 3500.50" : undefined}>
              <Input id="pay-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={amount !== "" && !amountOk} />
            </Field>
            <Field id="pay-method" label="Paid by">
              <NativeSelect id="pay-method" value={method} onChange={(e) => { setMethod(e.target.value); setAccountId(""); }}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="pay-account" label="Received into">
              <NativeSelect id="pay-account" value={account ?? ""} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}>
                {(accounts.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="pay-date" label="Date">
              <Input id="pay-date" type="date" max={today()} required value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field id="pay-ref" label="Reference" hint="Cheque, deposit slip or transaction no.">
              <Input id="pay-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field id="pay-remarks" label="Remarks">
              <Input id="pay-remarks" maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
          {amountOk && (
            <p className="text-sm" role="status">
              Settles {formatMoney(fromPaisa(allocated))}
              {advance > 0n && <> · {formatMoney(fromPaisa(advance))} kept as advance</>}
            </p>
          )}
          {manual && (!allocationOk || advance < 0n) && (
            <Alert variant="destructive">
              <AlertDescription>
                {advance < 0n ? "The chosen amounts are more than the payment." : "A chosen amount is more than what is owed on that line."}
              </AlertDescription>
            </Alert>
          )}
          <div>
            <Button type="submit" disabled={!canSubmit}>
              {pay.isPending ? "Saving…" : amountOk ? `Receive ${formatMoney(fromPaisa(paisa))}` : "Receive payment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function OpenLinesTable({
  lines,
  allocation,
  manual,
  onChange,
}: {
  lines: OpenLine[];
  allocation: string[];
  manual: boolean;
  onChange: (lineId: number, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Fee</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Owed</TableHead>
            <TableHead className="text-right">This payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={l.billLineId}>
              <TableCell>
                {l.studentName} <span className="text-xs text-muted-foreground">GR {l.grNo}</span>
              </TableCell>
              <TableCell>
                {l.description} <span className="text-xs text-muted-foreground">{l.billNo}</span>
              </TableCell>
              <TableCell>{formatDate(l.dueDate)}</TableCell>
              <TableCell className="text-right">{formatMoney(l.balance)}</TableCell>
              <TableCell className="text-right">
                {manual ? (
                  <Input
                    aria-label={`Amount for ${l.description}, ${l.studentName}`}
                    className="ms-auto w-28 text-right"
                    inputMode="decimal"
                    value={allocation[i]}
                    onChange={(e) => onChange(l.billLineId ?? 0, e.target.value)}
                  />
                ) : toPaisa(allocation[i]) > 0n ? (
                  formatMoney(allocation[i])
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentDone({ payment, onNext }: { payment: Payment; onNext: () => void }) {
  const can = useCan();
  const receipt = useMutation({
    mutationFn: () => fees.receipt(payment.id ?? 0),
    onSuccess: (blob) => openBlob(blob, `receipt-${payment.receiptNo?.replaceAll("/", "-")}.pdf`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertTitle>
            Received {formatMoney(payment.amount)} — receipt {payment.receiptNo}
            {payment.replayed ? " (already saved earlier)" : ""}
          </AlertTitle>
          <AlertDescription>
            Family {payment.familyNo} ({payment.fatherName}). Balance now <Balance value={payment.familyBalance} />
            {toPaisa(payment.creditRemaining) > 0n && <> · {formatMoney(payment.creditRemaining)} kept as advance</>}.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => receipt.mutate()} disabled={receipt.isPending}>
            <FileDown aria-hidden /> Download receipt
          </Button>
          <Button variant="outline" onClick={onNext}>
            Next payment
          </Button>
          {can(P.FEES_VIEW) && (
            <Button variant="outline" render={<Link href={`/app/fees/payments?open=${payment.id}`} />}>
              Payment details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
