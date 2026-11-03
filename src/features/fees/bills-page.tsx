"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, openBlob, type Schemas } from "@/lib/api/client";
import { fees, newKey, type RunReport } from "@/lib/api/fees";
import type { StudentRow } from "@/lib/api/people";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isAmount, toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { ClassSelect, Pager, SectionSelect, today, useCan, useClasses } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";
import { BillStatus, StudentPicker } from "./fee-shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const download = (name: string) => (blob: Blob) => openBlob(blob, name);

/** Bill runs (FR 10.5), vouchers (FR 10.6), late fees (FR 10.11) and the bills of the selected year. */
export function BillsPage() {
  const can = useCan();
  const generate = can(P.FEES_BILL_GENERATE);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bills & vouchers"
        description="Bills are made for the academic year chosen at the top. Running the same bills again never charges twice."
      />
      <Tabs defaultValue={generate ? "generate" : "bills"}>
        <TabsList>
          {generate && <TabsTrigger value="generate">Generate bills</TabsTrigger>}
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="runs">Bill runs</TabsTrigger>
          {generate && <TabsTrigger value="late">Late fee</TabsTrigger>}
          {generate && <TabsTrigger value="absent">Absent fine</TabsTrigger>}
        </TabsList>
        {generate && (
          <TabsContent value="generate" className="mt-4">
            <Generate />
          </TabsContent>
        )}
        <TabsContent value="bills" className="mt-4">
          <BillList />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <Runs />
        </TabsContent>
        {generate && (
          <TabsContent value="absent" className="mt-4">
            <AbsentFine />
          </TabsContent>
        )}
        {generate && (
          <TabsContent value="late" className="mt-4">
            <LateFee />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

type Scope = "SCHOOL" | "CLASSES" | "SECTION" | "STUDENT";

function Generate() {
  const queryClient = useQueryClient();
  const heads = useQuery({ queryKey: ["fees", "heads"], queryFn: fees.heads });
  const classes = useClasses();
  const [headIds, setHeadIds] = useState<number[]>([]);
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const [termLabel, setTermLabel] = useState("");
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [scope, setScope] = useState<Scope>("SCHOOL");
  const [classIds, setClassIds] = useState<number[]>([]);
  const [sectionId, setSectionId] = useState<number | "">("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [applyCredit, setApplyCredit] = useState(true);
  const [report, setReport] = useState<RunReport | null>(null);
  const chosen = (heads.data ?? []).filter((h) => headIds.includes(h.id ?? 0));
  const needsTerm = chosen.some((h) => h.frequency === "PER_TERM" || h.frequency === "CUSTOM");
  const body: Schemas["BillRunRequest"] = {
    title: title.trim() || undefined,
    period,
    termLabel: needsTerm ? termLabel.trim() : undefined,
    headIds,
    issueDate,
    dueDate: dueDate || undefined,
    classIds: scope === "CLASSES" ? classIds : undefined,
    sectionIds: scope === "SECTION" && sectionId !== "" ? [sectionId] : undefined,
    studentIds: scope === "STUDENT" && student ? [student.id ?? 0] : undefined,
    applyCredit,
  };
  const bodyKey = JSON.stringify(body);
  const key = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = useMutation({
    mutationFn: () => fees.runBills(body, key),
    onSuccess: (r) => {
      setReport(r);
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success(r.billsCreated ? `${r.billsCreated} bills made` : "No new bills: everything was already billed");
    },
    onError,
  });
  const scopeOk =
    scope === "SCHOOL" || (scope === "CLASSES" && classIds.length > 0) || (scope === "SECTION" && sectionId !== "") || (scope === "STUDENT" && student);
  const ready = headIds.length > 0 && scopeOk && (!needsTerm || termLabel.trim() !== "");
  return (
    <div className="flex flex-col gap-6">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) run.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>What to charge</CardTitle>
            <CardDescription>Amounts come from Fee set-up (or the student&apos;s own amount); discounts are applied automatically.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-2 text-sm font-medium">Fees</legend>
              {(heads.data ?? [])
                .filter((h) => h.status === "ACTIVE" && !h.systemCode)
                .map((h) => (
                  <label key={h.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={headIds.includes(h.id ?? 0)}
                      onCheckedChange={(c) => setHeadIds((ids) => (c ? [...ids, h.id ?? 0] : ids.filter((x) => x !== h.id)))}
                    />
                    {h.name}
                  </label>
                ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="run-period" label="Month" hint="For monthly fees">
                <Input id="run-period" type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
              </Field>
              {needsTerm && (
                <Field id="run-term" label="Term or period" hint="e.g. Term 1">
                  <Input id="run-term" required maxLength={30} value={termLabel} onChange={(e) => setTermLabel(e.target.value)} />
                </Field>
              )}
              <Field id="run-issue" label="Issue date">
                <Input id="run-issue" type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              <Field id="run-due" label="Due date" hint="Empty = the school's due day">
                <Input id="run-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field id="run-title" label="Title (optional)">
                <Input id="run-title" maxLength={200} value={title} placeholder="e.g. Fee bill October" onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Who</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Who to bill</legend>
              {(
                [
                  ["SCHOOL", "Whole school"],
                  ["CLASSES", "Some classes"],
                  ["SECTION", "One section"],
                  ["STUDENT", "One student"],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="run-scope" checked={scope === value} onChange={() => setScope(value)} />
                  {text}
                </label>
              ))}
            </fieldset>
            {scope === "CLASSES" && (
              <div className="flex flex-wrap gap-3 text-sm">
                {(classes.data ?? [])
                  .filter((c) => c.status === "ACTIVE")
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={classIds.includes(c.id ?? 0)}
                        onCheckedChange={(v) => setClassIds((ids) => (v ? [...ids, c.id ?? 0] : ids.filter((x) => x !== c.id)))}
                      />
                      {c.name}
                    </label>
                  ))}
              </div>
            )}
            {scope === "SECTION" && (
              <Field id="run-section" label="Section" className="max-w-xs">
                <SectionSelect id="run-section" value={sectionId} onChange={setSectionId} />
              </Field>
            )}
            {scope === "STUDENT" && <StudentPicker id="run-student" selected={student} onSelect={setStudent} />}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={applyCredit} onCheckedChange={(c) => setApplyCredit(c === true)} />
              Settle new bills from advance payments families already made
            </label>
            <div>
              <Button type="submit" disabled={!ready || run.isPending}>
                {run.isPending ? "Making bills…" : "Generate bills"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      {report && <RunResult report={report} />}
    </div>
  );
}

function RunResult({ report }: { report: RunReport }) {
  const vouchers = useMutation({
    mutationFn: () => fees.vouchers({ runId: report.runId }),
    onSuccess: download("vouchers.pdf"),
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Result{report.replayed ? " (this run was already done)" : ""}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground">Students in scope</dt>
          <dd>{report.students}</dd>
          <dt className="text-muted-foreground">Bills made</dt>
          <dd>{report.billsCreated}</dd>
          <dt className="text-muted-foreground">Fee lines</dt>
          <dd>{report.linesCreated}</dd>
          <dt className="text-muted-foreground">Already billed (skipped)</dt>
          <dd>{report.alreadyBilled}</dd>
          <dt className="text-muted-foreground">Total billed</dt>
          <dd>{formatMoney(report.totalBilled)}</dd>
          <dt className="text-muted-foreground">Settled from advance</dt>
          <dd>{formatMoney(report.creditApplied)}</dd>
        </dl>
        {(report.missing ?? []).length > 0 && (
          <Alert>
            <AlertTitle>{report.missing?.length} fees were not charged because no amount is set</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc ps-5">
                {report.missing?.slice(0, 20).map((m) => (
                  <li key={`${m.studentId}-${m.headName}`}>
                    {m.studentName} (GR {m.grNo}, {m.className}): {m.headName}
                  </li>
                ))}
              </ul>
              Set the amounts in Fee set-up and run again; only the missing fees will be added.
            </AlertDescription>
          </Alert>
        )}
        {(report.billsCreated ?? 0) > 0 && (
          <div>
            <Button variant="outline" disabled={vouchers.isPending} onClick={() => vouchers.mutate()}>
              <FileDown aria-hidden /> {vouchers.isPending ? "Preparing…" : "Print vouchers for this run"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillList() {
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const params = { status, classId: classId || undefined, sectionId: sectionId || undefined, q, page };
  const list = useQuery({ queryKey: ["fees", "bills", params], queryFn: () => fees.bills(params) });
  const sectionVouchers = useMutation({
    mutationFn: () => fees.vouchers({ sectionId: Number(sectionId) }),
    onSuccess: download("vouchers.pdf"),
    onError,
  });
  const voucher = useMutation({
    mutationFn: (id: number) => fees.voucher(id),
    onSuccess: download("voucher.pdf"),
    onError,
  });
  const reset = () => setPage(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="bill-q" label="Search">
          <Input id="bill-q" className="w-56" placeholder="Bill no., student, GR" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </Field>
        <Field id="bill-status" label="Status">
          <NativeSelect id="bill-status" className="w-36" value={status} onChange={(e) => { setStatus(e.target.value); reset(); }}>
            <option value="">All</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Part paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </NativeSelect>
        </Field>
        <Field id="bill-class" label="Class">
          <ClassSelect id="bill-class" className="w-36" value={classId} onChange={(v) => { setClassId(v); setSectionId(""); reset(); }} />
        </Field>
        <Field id="bill-section" label="Section">
          <SectionSelect id="bill-section" className="w-40" classId={classId} emptyLabel="All sections" value={sectionId} onChange={(v) => { setSectionId(v); reset(); }} />
        </Field>
        {sectionId !== "" && (
          <Button variant="outline" disabled={sectionVouchers.isPending} onClick={() => sectionVouchers.mutate()}>
            <FileDown aria-hidden /> Latest vouchers for section
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No bills" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill no.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"><span className="sr-only">Voucher</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setOpen(b.id ?? 0)}>
                        {b.billNo}
                      </button>
                    </TableCell>
                    <TableCell>
                      {b.studentName} <span className="text-xs text-muted-foreground">GR {b.grNo}</span>
                    </TableCell>
                    <TableCell>{b.className ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">{b.title}</TableCell>
                    <TableCell>{formatDate(b.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatMoney(b.total)}</TableCell>
                    <TableCell className="text-right">{formatMoney(b.balance)}</TableCell>
                    <TableCell>
                      <BillStatus status={b.status} />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" aria-label={`Voucher ${b.billNo}`} onClick={() => voucher.mutate(b.id ?? 0)}>
                        <FileDown aria-hidden /> Voucher
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
      {open != null && <BillDialog billId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One bill with its lines; a line can be corrected (FR 10.13) by someone allowed to request corrections. */
export function BillDialog({ billId, onClose }: { billId: number; onClose: () => void }) {
  const can = useCan();
  const bill = useQuery({ queryKey: ["fees", "bill", billId], queryFn: () => fees.bill(billId) });
  const [correcting, setCorrecting] = useState<Schemas["BillLineView"] | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bill {bill.data?.billNo}</DialogTitle>
          {bill.data && (
            <DialogDescription>
              {bill.data.studentName} (GR {bill.data.grNo}) · {bill.data.className} - {bill.data.sectionName} · due{" "}
              {formatDate(bill.data.dueDate)}
            </DialogDescription>
          )}
        </DialogHeader>
        {bill.isPending ? (
          <Loading />
        ) : bill.isError ? (
          <ErrorState error={bill.error} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Corrections</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                {can(P.FEES_ADJUST_REQUEST) && <TableHead><span className="sr-only">Correct</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bill.data.lines ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {l.description}
                    {l.discountNote && <span className="block text-xs text-muted-foreground">{l.discountNote}</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(l.gross)}</TableCell>
                  <TableCell className="text-right">{toPaisa(l.discount) > 0n ? formatMoney(l.discount) : "—"}</TableCell>
                  <TableCell className="text-right">{toPaisa(l.adjusted) !== 0n ? formatMoney(l.adjusted) : "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.paid)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(l.balance)}</TableCell>
                  {can(P.FEES_ADJUST_REQUEST) && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setCorrecting(l)}>
                        Correct
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {correcting && <CorrectionDialog line={correcting} onClose={() => setCorrecting(null)} />}
      </DialogContent>
    </Dialog>
  );
}

export function CorrectionDialog({ line, onClose }: { line: Schemas["BillLineView"] | Schemas["OpenLine"]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const lineId = "id" in line && line.id != null ? line.id : (line as Schemas["OpenLine"]).billLineId;
  const [kind, setKind] = useState("CORRECTION");
  const [direction, setDirection] = useState<"reduce" | "increase">("reduce");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      fees.requestAdjustment({
        billLineId: lineId ?? 0,
        amount: (kind === "CORRECTION" && direction === "increase" ? "" : "-") + amount.trim(),
        kind,
        reason,
      }),
    onSuccess: (a) => {
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success(a.status === "APPROVED" ? "Correction applied" : "Correction sent for approval");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Correct {line.description}</DialogTitle>
            <DialogDescription>
              The original charge stays on record. The correction takes effect when approved; if the fee was already paid,
              the difference becomes advance credit.
            </DialogDescription>
          </DialogHeader>
          <Field id="adj-kind" label="Type">
            <NativeSelect id="adj-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="CORRECTION">Correction (wrong amount)</option>
              <option value="WAIVER">Waive (forgive)</option>
              <option value="BAD_DEBT">Write off as bad debt</option>
            </NativeSelect>
          </Field>
          {kind === "CORRECTION" && (
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Direction</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="adj-dir" checked={direction === "reduce"} onChange={() => setDirection("reduce")} /> Reduce
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="adj-dir" checked={direction === "increase"} onChange={() => setDirection("increase")} /> Increase
              </label>
            </fieldset>
          )}
          <Field id="adj-amount" label="Amount (Rs.)">
            <Input id="adj-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field id="adj-reason" label="Reason">
            <Textarea id="adj-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isAmount(amount) || !reason.trim() || submit.isPending}>
              {submit.isPending ? "Saving…" : "Save correction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Runs() {
  const runs = useQuery({ queryKey: ["fees", "runs"], queryFn: fees.runs });
  const vouchers = useMutation({
    mutationFn: (runId: number) => fees.vouchers({ runId }),
    onSuccess: download("vouchers.pdf"),
    onError,
  });
  if (runs.isPending) return <Loading />;
  if (runs.isError) return <ErrorState error={runs.error} onRetry={() => runs.refetch()} />;
  if (runs.data.length === 0) return <Empty title="No bill runs in this year yet" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>What</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Bills / lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead><span className="sr-only">Vouchers</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDateTime(r.startedAt)}</TableCell>
                <TableCell>
                  {r.kind === "LATE_FEE" ? "Late fee" : r.title}
                  {r.status !== "DONE" && <span className="ms-2 text-xs text-amber-700">not finished — run it again to complete</span>}
                </TableCell>
                <TableCell>{r.createdBy}</TableCell>
                <TableCell className="text-right">
                  {r.report ? `${r.report.billsCreated} / ${r.report.linesCreated}` : "—"}
                </TableCell>
                <TableCell className="text-right">{r.report ? formatMoney(r.report.totalBilled) : "—"}</TableCell>
                <TableCell>
                  {r.kind === "BILLS" && (r.report?.billsCreated ?? 0) > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => vouchers.mutate(r.id ?? 0)}>
                      <FileDown aria-hidden /> Vouchers
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Absent fine (FR 10.12): fine per day × unexplained absences in the month, once per student and month. */
function AbsentFine() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [report, setReport] = useState<RunReport | null>(null);
  const key = useMemo(() => newKey(), [month]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = useMutation({
    mutationFn: () => fees.runAbsentFine(month, key),
    onSuccess: (r) => {
      setReport(r);
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Absent fine</CardTitle>
        <CardDescription>
          Charges the fine per day set in Rules &amp; settings for each day marked absent. Leave and holidays never count. Running it again
          for the same month adds nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="af-month" label="Month">
            <Input id="af-month" type="month" max={today().slice(0, 7)} value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Button disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Applying…" : "Apply absent fine"}</Button>
        </div>
        {report && (
          <p className="text-sm" role="status">
            {report.billsCreated} students fined ({formatMoney(report.totalBilled)}). {report.alreadyBilled} were already fined for this month.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LateFee() {
  const queryClient = useQueryClient();
  const classes = useClasses();
  const { selected } = useYear();
  const [yesterday] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const [dueOnOrBefore, setDue] = useState(yesterday);
  const [amount, setAmount] = useState("");
  const [exclude, setExclude] = useState<number[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const body = { dueOnOrBefore, amount: amount.trim() || undefined, excludeClassIds: exclude };
  const bodyKey = JSON.stringify(body);
  const key = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = useMutation({
    mutationFn: () => fees.runLateFee(body, key),
    onSuccess: (r) => {
      setReport(r);
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Late fee</CardTitle>
        <CardDescription>
          Adds the late fee once to every bill in {selected?.name} that was due on or before the date and is still unpaid.
          Running it again adds nothing to bills that already have it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="late-due" label="Bills due on or before">
              <Input id="late-due" type="date" required max={yesterday} value={dueOnOrBefore} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field id="late-amount" label="Late fee (Rs.)" hint="Empty = the amount in Rules & settings">
              <Input id="late-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="mb-1 text-sm font-medium">Do not charge these classes</legend>
            {(classes.data ?? [])
              .filter((c) => c.status === "ACTIVE")
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <Checkbox checked={exclude.includes(c.id ?? 0)} onCheckedChange={(v) => setExclude((ids) => (v ? [...ids, c.id ?? 0] : ids.filter((x) => x !== c.id)))} />
                  {c.name}
                </label>
              ))}
          </fieldset>
          <div>
            <Button type="submit" disabled={run.isPending || (amount !== "" && !isAmount(amount))}>
              {run.isPending ? "Applying…" : "Apply late fee"}
            </Button>
          </div>
          {report && (
            <p className="text-sm" role="status">
              Late fee added to {report.linesCreated} bills ({formatMoney(report.totalBilled)}). {report.alreadyBilled} bills already had it.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
