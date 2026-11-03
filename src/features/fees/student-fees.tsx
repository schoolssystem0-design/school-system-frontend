"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { fees, newKey, type Ledger, type OpenLine } from "@/lib/api/fees";
import { formatDate, formatMoney } from "@/lib/format";
import { fromPaisa, isAmount, toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { useCan } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";
import { CorrectionDialog } from "./bills-page";
import { DiscountsPage } from "./discounts-page";
import { Balance } from "./fee-shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const ENTRY_LABELS: Record<string, string> = {
  CHARGE: "Charged",
  CORRECTION: "Correction",
  WAIVER: "Waived",
  BAD_DEBT: "Written off",
  PAYMENT: "Paid",
  CREDIT_USED: "Paid from advance",
  REVERSAL: "Payment reversed",
  MOVED_TO_CREDIT: "Moved to advance",
};

/** Charges, corrections and payments with a running balance (FR 10.14). */
export function LedgerTable({ ledger, showStudent }: { ledger: Ledger; showStudent?: boolean }) {
  if ((ledger.entries ?? []).length === 0) return <Empty title="No fees charged or paid yet" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Reference</TableHead>
            {showStudent && <TableHead>Student</TableHead>}
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Charged</TableHead>
            <TableHead className="text-right">Paid / reduced</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger.entries?.map((e, i) => (
            <TableRow key={i}>
              <TableCell>{formatDate(e.date)}</TableCell>
              <TableCell>{ENTRY_LABELS[e.type ?? ""] ?? e.type}</TableCell>
              <TableCell>{e.reference}</TableCell>
              {showStudent && <TableCell>{e.studentName ?? "Family"}</TableCell>}
              <TableCell className="max-w-64 truncate">{e.description}</TableCell>
              <TableCell className="text-right">{e.debit ? formatMoney(e.debit) : ""}</TableCell>
              <TableCell className="text-right">{e.credit ? formatMoney(e.credit) : ""}</TableCell>
              <TableCell className="text-right">
                <Balance value={e.balance} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The Fees tab of a student's profile. */
export function StudentFees({ studentId, familyId }: { studentId: number; familyId?: number }) {
  const can = useCan();
  const [correcting, setCorrecting] = useState<OpenLine | null>(null);
  const ledger = useQuery({ queryKey: ["fees", "student-ledger", studentId], queryFn: () => fees.studentLedger(studentId) });
  const open = useQuery({
    queryKey: ["fees", "open-lines", familyId, studentId],
    queryFn: () => fees.openLines(familyId ?? 0, studentId),
    enabled: familyId != null,
  });
  return (
    <div className="flex flex-col gap-6">
      {can(P.FEES_BILL_GENERATE) && <AdmissionProposal studentId={studentId} />}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Fees</CardTitle>
            {ledger.data && (
              <CardDescription>
                Owed <Balance value={ledger.data.owed} />
                {toPaisa(ledger.data.credit) > 0n && <> · advance for this student {formatMoney(ledger.data.credit)}</>}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {can(P.FEES_PAYMENT_ADD) && familyId && (
              <Button size="sm" render={<Link href={`/app/fees/collect?familyId=${familyId}`} />}>
                Collect fees
              </Button>
            )}
            {familyId && (
              <Button size="sm" variant="outline" render={<Link href={`/app/families/${familyId}`} />}>
                Family ledger
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ledger.isPending ? <Loading /> : ledger.isError ? <ErrorState error={ledger.error} /> : <LedgerTable ledger={ledger.data} />}
        </CardContent>
      </Card>
      {can(P.FEES_ADJUST_REQUEST) && (open.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unpaid fees</CardTitle>
            <CardDescription>Correct a wrong charge, waive it or write it off (needs approval).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead><span className="sr-only">Correct</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.data?.map((l) => (
                  <TableRow key={l.billLineId}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell>{formatDate(l.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatMoney(l.balance)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setCorrecting(l)}>
                        Correct
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <StudentAmounts studentId={studentId} />
      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountsPage studentId={studentId} />
        </CardContent>
      </Card>
      {correcting && <CorrectionDialog line={correcting} onClose={() => setCorrecting(null)} />}
    </div>
  );
}

/** Proposes the admission charges after enrolment (FR 4.10) and makes the bill in one click. */
function AdmissionProposal({ studentId }: { studentId: number }) {
  const queryClient = useQueryClient();
  const proposal = useQuery({
    queryKey: ["fees", "admission-proposal", studentId],
    queryFn: () => fees.admissionProposal(studentId),
  });
  const lines = proposal.data ?? [];
  const linesKey = JSON.stringify(lines);
  const key = useMemo(() => newKey(), [linesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthly = lines.find((l) => /^\d{4}-\d{2}$/.test(l.periodKey ?? ""));
  const create = useMutation({
    mutationFn: () =>
      fees.runBills(
        {
          title: "Admission charges",
          headIds: [...new Set(lines.map((l) => l.feeHeadId ?? 0))],
          studentIds: [studentId],
          period: monthly?.periodKey,
        },
        key,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success("Admission bill made");
    },
    onError,
  });
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, l) => sum + toPaisa(l.net), 0n);
  return (
    <Alert>
      <AlertTitle>Admission charges not billed yet</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <ul className="list-disc ps-5">
          {lines.map((l) => (
            <li key={`${l.feeHeadId}-${l.periodKey}`}>
              {l.description}: {formatMoney(l.net)}
              {l.discountNote && <span className="text-muted-foreground"> ({l.discountNote})</span>}
            </li>
          ))}
        </ul>
        <div>
          <Button size="sm" disabled={create.isPending} onClick={() => create.mutate()}>
            Make admission bill ({formatMoney(fromPaisa(total))})
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** A student's own amount for a fee in the selected year, replacing the class amount (FR 10.2). */
function StudentAmounts({ studentId }: { studentId: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const { selected } = useYear();
  const yearId = selected?.id ?? 0;
  const heads = useQuery({ queryKey: ["fees", "heads"], queryFn: fees.heads });
  const overrides = useQuery({
    queryKey: ["fees", "overrides", studentId, yearId],
    queryFn: () => fees.overrides(studentId, yearId),
    enabled: yearId > 0,
  });
  const [feeHeadId, setFeeHeadId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: (remove?: number) =>
      fees.saveOverride(studentId, {
        academicYearId: yearId,
        feeHeadId: remove ?? Number(feeHeadId),
        amount: remove ? undefined : amount,
        reason: remove ? "Back to the class amount" : reason,
      }),
    onSuccess: () => {
      setAmount("");
      setReason("");
      setFeeHeadId("");
      void queryClient.invalidateQueries({ queryKey: ["fees", "overrides"] });
    },
    onError,
  });
  const manage = can(P.FEES_SETUP);
  if (!manage && (overrides.data ?? []).length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student&apos;s own amounts ({selected?.name})</CardTitle>
        <CardDescription>Used instead of the class amount on new bills, e.g. a special transport route.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(overrides.data ?? []).length > 0 && (
          <ul className="flex flex-col divide-y rounded-md border">
            {overrides.data?.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  {o.headName}: <strong>{formatMoney(o.amount)}</strong> <span className="text-muted-foreground">({o.reason})</span>
                </span>
                {manage && (
                  <Button size="sm" variant="ghost" onClick={() => save.mutate(o.feeHeadId)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {manage && selected?.status !== "CLOSED" && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(undefined);
            }}
          >
            <Field id="ov-head" label="Fee">
              <NativeSelect id="ov-head" className="w-48" required value={feeHeadId} onChange={(e) => setFeeHeadId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose</option>
                {(heads.data ?? [])
                  .filter((h) => !h.systemCode && h.status === "ACTIVE")
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field id="ov-amount" label="Amount (Rs.)">
              <Input id="ov-amount" className="w-32" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field id="ov-reason" label="Reason">
              <Input id="ov-reason" className="w-56" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="submit" disabled={feeHeadId === "" || !isAmount(amount, { allowZero: true }) || !reason.trim() || save.isPending}>
              Save
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Fees card on the family page: combined ledger, follow-ups and quick actions. */
export function FamilyFees({ familyId }: { familyId: number }) {
  const can = useCan();
  const ledger = useQuery({ queryKey: ["fees", "family-ledger", familyId], queryFn: () => fees.familyLedger(familyId) });
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Fees</CardTitle>
          {ledger.data && (
            <CardDescription>
              Balance <Balance value={ledger.data.balance} />
              {toPaisa(ledger.data.credit) > 0n && <> · advance held {formatMoney(ledger.data.credit)}</>}
            </CardDescription>
          )}
        </div>
        {can(P.FEES_PAYMENT_ADD) && (
          <Button size="sm" render={<Link href={`/app/fees/collect?familyId=${familyId}`} />}>
            Collect fees
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {ledger.isPending ? <Loading /> : ledger.isError ? <ErrorState error={ledger.error} /> : <LedgerTable ledger={ledger.data} showStudent />}
      </CardContent>
    </Card>
  );
}
