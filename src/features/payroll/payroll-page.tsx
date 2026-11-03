"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, openBlob } from "@/lib/api/client";
import { accounts, payroll, type SalaryLine, type Sheet } from "@/lib/api/accounts";
import { newKey } from "@/lib/api/fees";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";
import { ExportBar } from "@/features/reports/export-bar";

const onError = (e: unknown) => toast.error(errorMessage(e));

const STATUS: Record<string, string> = { DRAFT: "Draft", APPROVED: "Approved", PAID: "Paid", REVERSED: "Reversed" };

function SheetStatus({ status }: { status?: string }) {
  const variant = status === "PAID" ? "default" : status === "REVERSED" ? "secondary" : "outline";
  return <Badge variant={variant}>{STATUS[status ?? ""] ?? status}</Badge>;
}

/** Monthly salary sheets (FR 6.8, 13.12). */
export function PayrollPage() {
  const can = useCan();
  const guard = useStepUp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sheets = useQuery({ queryKey: ["payroll", "sheets"], queryFn: payroll.sheets });
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const generate = useMutation({
    mutationFn: () => guard(() => payroll.generate(month)),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      if ((s.skipped ?? []).length > 0) toast.warning(`${s.skipped?.length} staff have no salary recorded and were left out`);
      router.push(`/app/payroll/${s.id}`);
    },
    onError,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payroll" description="Salary from each person's salary record, less deductions under the school's salary rules." />
      <ExportBar title="Payroll" />
      {can(P.PAYROLL_MANAGE) && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <Field id="pay-month" label="Month">
              <Input id="pay-month" type="month" max={today().slice(0, 7)} value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Button disabled={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? "Preparing…" : "Prepare salary sheet"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {sheets.isPending ? (
            <Loading />
          ) : sheets.isError ? (
            <ErrorState error={sheets.error} />
          ) : sheets.data.length === 0 ? (
            <div className="p-6"><Empty title="No salary sheets yet" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prepared</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/payroll/${s.id}`}>{s.month}</Link>
                    </TableCell>
                    <TableCell>{s.staffCount}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.totalNet)}</TableCell>
                    <TableCell><SheetStatus status={s.status} /></TableCell>
                    <TableCell>{s.createdBy} <span className="block text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SheetPage() {
  const id = Number(useParams<{ id: string }>().id);
  const sheet = useQuery({ queryKey: ["payroll", "sheet", id], queryFn: () => payroll.sheet(id) });
  if (sheet.isPending) return <Loading />;
  if (sheet.isError) return <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />;
  return <SheetView sheet={sheet.data} />;
}

function SheetView({ sheet }: { sheet: Sheet }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SalaryLine | null>(null);
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["payroll"] });
  const approve = useMutation({
    mutationFn: () => guard(() => payroll.approve(sheet.id ?? 0)),
    onSuccess: () => {
      void refresh();
      toast.success("Salary sheet approved and recorded in the accounts");
    },
    onError,
  });
  const reverse = useMutation({
    mutationFn: (reason: string) => guard(() => payroll.reverse(sheet.id ?? 0, reason)),
    onSuccess: () => {
      setReversing(false);
      void refresh();
      toast.success(sheet.status === "DRAFT" ? "Draft discarded" : "Salary sheet reversed");
    },
    onError,
  });
  const slips = useMutation({
    mutationFn: (lineId?: number) => payroll.slips(sheet.id ?? 0, lineId),
    onSuccess: (b) => openBlob(b, `salary-slips-${sheet.month}.pdf`),
    onError,
  });
  const draft = sheet.status === "DRAFT";
  const printable = sheet.status === "APPROVED" || sheet.status === "PAID";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Salaries for ${sheet.month}`}
        description={`${sheet.workingDays} working days · ${(sheet.lines ?? []).length} staff · net ${formatMoney(sheet.totalNet)}`}
        actions={
          <>
            <SheetStatus status={sheet.status} />
            {printable && (
              <Button variant="outline" disabled={slips.isPending} onClick={() => slips.mutate(undefined)}>
                <FileDown aria-hidden /> All slips
              </Button>
            )}
            {draft && can(P.PAYROLL_APPROVE) && <Button disabled={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>}
            {sheet.status === "APPROVED" && can(P.PAYROLL_PAY) && <Button onClick={() => setPaying(true)}>Pay salaries</Button>}
            {sheet.status !== "REVERSED" && (draft ? can(P.PAYROLL_MANAGE) : can(P.PAYROLL_APPROVE)) && (
              <Button variant="destructive" onClick={() => setReversing(true)}>{draft ? "Discard" : "Reverse"}</Button>
            )}
          </>
        }
      />
      {draft && (
        <Alert>
          <AlertTitle>Draft</AlertTitle>
          <AlertDescription>
            Enter each person&apos;s absent, half, late and leave days, lectures, allowances and deductions. Once approved the sheet
            is locked; a mistake after that is corrected by reversing the sheet and making it again.
          </AlertDescription>
        </Alert>
      )}
      {sheet.status === "PAID" && (
        <p className="text-sm text-muted-foreground">
          Paid on {formatDate(sheet.paymentDate)} from {sheet.paymentAccountName} by {sheet.paidBy}.
        </p>
      )}
      {sheet.status === "REVERSED" && (
        <p className="text-sm text-muted-foreground">Reversed by {sheet.reversedBy}: {sheet.reversalReason}</p>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead className="text-right">Deduction</TableHead>
                <TableHead className="text-right">Allowance</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Tax + other</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.lines?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-medium">{l.staffName}</span>
                    <span className="block text-xs text-muted-foreground">{l.employeeNo} · {l.designation}</span>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(l.basic)}</TableCell>
                  <TableCell className="text-xs">
                    A {l.absentDays} · H {l.halfDays} · L {l.lateDays} · Lv {l.leaveDays}
                    {(l.lectures ?? 0) > 0 && ` · ${l.lectures} lectures`}
                    <span className="block text-muted-foreground">{l.deductionDays} days deducted</span>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(l.attendanceDeduction)}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.allowance)}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.earned)}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(l.tax)}
                    {l.otherDeduction !== "0.00" && <span className="block text-xs text-muted-foreground">+ {formatMoney(l.otherDeduction)} {l.otherNote}</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(l.net)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {draft && can(P.PAYROLL_MANAGE) && <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button>}
                    {printable && <Button size="sm" variant="ghost" onClick={() => slips.mutate(l.id)}>Slip</Button>}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell colSpan={5}>Total</TableCell>
                <TableCell className="text-right">{formatMoney(sheet.totalEarned)}</TableCell>
                <TableCell className="text-right">{formatMoney(sheet.totalTax)}</TableCell>
                <TableCell className="text-right">{formatMoney(sheet.totalNet)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && <LineDialog line={editing} onClose={() => setEditing(null)} />}
      {paying && <PayDialog sheet={sheet} onClose={() => setPaying(false)} />}
      <ConfirmDialog
        open={reversing}
        onOpenChange={setReversing}
        title={draft ? "Discard this draft?" : `Reverse the salaries for ${sheet.month}?`}
        description={draft ? undefined : "The accounts entries are reversed. You can then prepare the month again."}
        confirmLabel={draft ? "Discard" : "Reverse"}
        destructive
        requireReason
        pending={reverse.isPending}
        onConfirm={(reason) => reverse.mutate(reason)}
      />
    </div>
  );
}

function LineDialog({ line, onClose }: { line: SalaryLine; onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    absentDays: String(line.absentDays ?? 0),
    halfDays: String(line.halfDays ?? 0),
    lateDays: String(line.lateDays ?? 0),
    leaveDays: String(line.leaveDays ?? 0),
    lectures: String(line.lectures ?? 0),
    allowance: line.allowance === "0.00" ? "" : (line.allowance ?? ""),
    tax: line.tax === "0.00" ? "" : (line.tax ?? ""),
    otherDeduction: line.otherDeduction === "0.00" ? "" : (line.otherDeduction ?? ""),
    otherNote: line.otherNote ?? "",
  });
  const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : -1);
  const save = useMutation({
    mutationFn: () =>
      guard(() =>
        payroll.updateLine(line.id ?? 0, {
          absentDays: int(form.absentDays),
          halfDays: int(form.halfDays),
          lateDays: int(form.lateDays),
          leaveDays: int(form.leaveDays),
          lectures: int(form.lectures),
          allowance: form.allowance || undefined,
          tax: form.tax || undefined,
          otherDeduction: form.otherDeduction || undefined,
          otherNote: form.otherNote || undefined,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      onClose();
    },
    onError,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const daysOk = ["absentDays", "halfDays", "lateDays", "leaveDays", "lectures"].every((k) => int(form[k as keyof typeof form]) >= 0);
  const moneyOk = ["allowance", "tax", "otherDeduction"].every((k) => form[k as keyof typeof form] === "" || isAmount(form[k as keyof typeof form], { allowZero: true }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>{line.staffName}</DialogTitle>
            <DialogDescription>
              Basic {formatMoney(line.basic)} for {line.workingDays} working days. Late days and extra leave are converted to absences
              under the school&apos;s salary rules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="ln-absent" label="Absent days"><Input id="ln-absent" inputMode="numeric" value={form.absentDays} onChange={set("absentDays")} /></Field>
            <Field id="ln-half" label="Half days"><Input id="ln-half" inputMode="numeric" value={form.halfDays} onChange={set("halfDays")} /></Field>
            <Field id="ln-late" label="Late days"><Input id="ln-late" inputMode="numeric" value={form.lateDays} onChange={set("lateDays")} /></Field>
            <Field id="ln-leave" label="Leave days"><Input id="ln-leave" inputMode="numeric" value={form.leaveDays} onChange={set("leaveDays")} /></Field>
            {line.perLectureRate && (
              <Field id="ln-lectures" label={`Lectures (${formatMoney(line.perLectureRate)} each)`}><Input id="ln-lectures" inputMode="numeric" value={form.lectures} onChange={set("lectures")} /></Field>
            )}
            <Field id="ln-allow" label="Allowance (Rs.)"><Input id="ln-allow" inputMode="decimal" value={form.allowance} onChange={set("allowance")} /></Field>
            <Field id="ln-tax" label="Income tax (Rs.)"><Input id="ln-tax" inputMode="decimal" value={form.tax} onChange={set("tax")} /></Field>
            <Field id="ln-other" label="Other deduction (Rs.)"><Input id="ln-other" inputMode="decimal" value={form.otherDeduction} onChange={set("otherDeduction")} /></Field>
            <Field id="ln-note" label="Other deduction for"><Input id="ln-note" maxLength={300} value={form.otherNote} onChange={set("otherNote")} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!daysOk || !moneyOk || save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ sheet, onClose }: { sheet: Sheet; onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["accounts", "money", false], queryFn: () => accounts.moneyAccounts() });
  const [accountId, setAccountId] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(today);
  const body = { accountId: Number(accountId), paymentDate };
  const bodyKey = JSON.stringify(body);
  const key = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = useMutation({
    mutationFn: () => guard(() => payroll.pay(sheet.id ?? 0, body, key)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Salaries paid");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="contents" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Pay {formatMoney(sheet.totalNet)}</DialogTitle>
            <DialogDescription>Salaries for {sheet.month}, recorded as paid from one account.</DialogDescription>
          </DialogHeader>
          <Field id="pay-acc" label="Paid from">
            <NativeSelect id="pay-acc" required value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose</option>
              {(list.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>)}
            </NativeSelect>
          </Field>
          <Field id="pay-date" label="Date">
            <Input id="pay-date" type="date" max={today()} required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={accountId === "" || pay.isPending}>{pay.isPending ? "Paying…" : "Pay"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
