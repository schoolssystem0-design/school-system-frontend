"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, CalendarClock, FileDown, Play, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, openBlob } from "@/lib/api/client";
import { billing, type Invoice, type Subscription } from "@/lib/api/business";
import { formatDate, formatMoney } from "@/lib/format";

const onError = (e: unknown) => toast.error(errorMessage(e));

function todayPk() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

const STANDING: Record<string, { label: string; className: string }> = {
  PAID_UP: { label: "Paid up", className: "bg-emerald-600 text-white" },
  DUE: { label: "Invoice due", className: "bg-primary text-white" },
  OVERDUE: { label: "Overdue", className: "bg-highlight text-highlight-foreground" },
  PAUSED: { label: "Access paused", className: "bg-destructive text-white" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-foreground" },
  NONE: { label: "No plan", className: "bg-muted text-muted-foreground" },
  TRIAL: { label: "On trial", className: "bg-primary/15 text-primary" },
};

export function StandingBadge({ standing }: { standing?: string }) {
  const s = STANDING[standing ?? ""] ?? { label: standing ?? "—", className: "bg-muted text-foreground" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function InvoiceStatus({ i }: { i: Invoice }) {
  if (i.status === "PAID") return <Badge className="bg-emerald-600 text-white">Paid {formatDate(i.paidOn)}</Badge>;
  if (i.status === "VOID") return <Badge variant="secondary">Cancelled</Badge>;
  if (i.paused) return <Badge variant="destructive">Unpaid · access paused</Badge>;
  if (i.overdue) return <Badge className="bg-highlight text-highlight-foreground">Overdue</Badge>;
  return <Badge variant="outline">Unpaid</Badge>;
}

const plan = (cycle?: string) => (cycle === "YEARLY" ? "Yearly" : "Monthly");

/** Owner's billing page: totals, payment details, every school's plan and all invoices. */
export function BillingPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["platform", "billing"], queryFn: billing.overview });
  const [filter, setFilter] = useState("UNPAID");
  const [details, setDetails] = useState<string | null>(null);
  const saveDetails = useMutation({
    mutationFn: () => billing.setPaymentDetails(details ?? ""),
    onSuccess: () => {
      toast.success("Payment details saved. They appear on every invoice and reminder.");
      setDetails(null);
      void queryClient.invalidateQueries({ queryKey: ["platform", "billing"] });
    },
    onError,
  });
  const run = useMutation({
    mutationFn: billing.run,
    onSuccess: (r) => {
      toast.success(`${r.invoicesIssued ?? 0} invoices issued, ${r.remindersSent ?? 0} reminders sent`);
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
    onError,
  });
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const s = o.summary;
  const invoices = (o.invoices ?? []).filter((i) =>
    filter === "ALL" ? true : filter === "OVERDUE" ? i.overdue : i.status === filter,
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing"
        description="Monthly and yearly subscriptions (no student limit). Invoices are issued a week before each period and reminders go out by themselves."
        actions={
          <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
            <Play aria-hidden /> Issue due invoices now
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={BadgeCheck} label="Paying schools" value={s?.payingSchools ?? 0} detail={`${s?.monthly ?? 0} monthly · ${s?.yearly ?? 0} yearly`} tone="success" />
        <StatTile icon={CalendarClock} label="Expected this month" value={formatMoney(s?.expectedThisMonth)} detail={`Received ${formatMoney(s?.receivedThisMonth)}`} />
        <StatTile icon={Receipt} label="Unpaid" value={formatMoney(s?.unpaid)} detail={`Overdue ${formatMoney(s?.overdue)}`} tone="warning" />
        <StatTile icon={AlertTriangle} label="Access paused" value={s?.pausedSchools ?? 0} detail="Schools with an invoice unpaid past grace" tone={s?.pausedSchools ? "danger" : "primary"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How schools pay you</CardTitle>
          <CardDescription>Printed on every invoice and reminder: bank account, Raast ID or how to pay in cash.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {details === null ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="whitespace-pre-line text-sm">{o.paymentDetails || <span className="text-muted-foreground">Not set yet</span>}</p>
              <Button variant="outline" size="sm" onClick={() => setDetails(o.paymentDetails ?? "")}>
                Edit
              </Button>
            </div>
          ) : (
            <>
              <Textarea rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} aria-label="Payment details"
                placeholder={"Meezan Bank, Tirvex Tech, account 0123-4567890\nRaast ID: 0300-0000000"} />
              <div className="flex gap-2">
                <Button size="sm" disabled={saveDetails.isPending} onClick={() => saveDetails.mutate()}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setDetails(null)}>Cancel</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Set or change a school&apos;s plan from its page (All schools, then the school).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Next invoice for</TableHead>
                <TableHead>Standing</TableHead>
                <TableHead className="text-right">Unpaid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(o.subscriptions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No subscriptions yet. Open a school and start its plan.
                  </TableCell>
                </TableRow>
              )}
              {(o.subscriptions ?? []).map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <Link href={`/platform/schools/${sub.schoolId}`} className="font-medium underline-offset-4 hover:underline">{sub.schoolName}</Link>
                    <span className="block text-xs text-muted-foreground">{sub.schoolCode}</span>
                  </TableCell>
                  <TableCell>{sub.status === "CANCELLED" ? "Cancelled" : plan(sub.cycle)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sub.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap">{sub.status === "CANCELLED" ? "—" : formatDate(sub.nextDueOn)}</TableCell>
                  <TableCell><StandingBadge standing={sub.standing} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sub.unpaidAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Mark an invoice paid when the money arrives: access returns at once and a receipt is emailed.</CardDescription>
          </div>
          <Field id="inv-filter" label="Show">
            <NativeSelect id="inv-filter" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="UNPAID">Unpaid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Cancelled</option>
              <option value="ALL">All</option>
            </NativeSelect>
          </Field>
        </CardHeader>
        <CardContent className="p-0">
          <InvoiceTable invoices={invoices} showSchool />
        </CardContent>
      </Card>
    </div>
  );
}

/** Invoices with their actions: mark paid, cancel, download. */
export function InvoiceTable({ invoices, showSchool }: { invoices: Invoice[]; showSchool?: boolean }) {
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const pdf = useMutation({
    mutationFn: (i: Invoice) => billing.pdf(i.id ?? 0).then((blob) => openBlob(blob, `${i.invoiceNo}.pdf`)),
    onError,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["platform"] });
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            {showSchool && <TableHead>School</TableHead>}
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={showSchool ? 7 : 6} className="py-6 text-center text-sm text-muted-foreground">No invoices</TableCell>
            </TableRow>
          )}
          {invoices.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium tabular-nums">{i.invoiceNo}</TableCell>
              {showSchool && (
                <TableCell>
                  {i.schoolId ? <Link href={`/platform/schools/${i.schoolId}`} className="underline-offset-4 hover:underline">{i.schoolName}</Link> : i.schoolName}
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap text-sm">
                {plan(i.cycle)} · {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(i.amount)}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(i.dueOn)}</TableCell>
              <TableCell><InvoiceStatus i={i} /></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {i.status === "UNPAID" && (
                    <>
                      <Button size="sm" onClick={() => setPaying(i)}>Mark paid</Button>
                      <Button size="sm" variant="ghost" onClick={() => setVoiding(i)}>Cancel</Button>
                    </>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label={`Download ${i.invoiceNo}`} onClick={() => pdf.mutate(i)}>
                    <FileDown aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {paying && <PayDialog invoice={paying} onClose={() => setPaying(null)} onDone={refresh} />}
      {voiding && <VoidDialog invoice={voiding} onClose={() => setVoiding(null)} onDone={refresh} />}
    </div>
  );
}

function PayDialog({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const [paidOn, setPaidOn] = useState(todayPk());
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const pay = useMutation({
    mutationFn: () => billing.pay(invoice.id ?? 0, { paidOn, method, reference: reference.trim() || undefined }),
    onSuccess: () => {
      toast.success(`${invoice.invoiceNo} marked paid. A receipt was emailed to the school.`);
      onDone();
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment for {invoice.invoiceNo}</DialogTitle>
          <DialogDescription>
            {invoice.schoolName} · {formatMoney(invoice.amount)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field id="pay-on" label="Received on">
            <Input id="pay-on" type="date" max={todayPk()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field id="pay-how" label="Paid by">
            <NativeSelect id="pay-how" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Bank transfer", "Raast", "Cash", "Cheque", "JazzCash", "Easypaisa"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="pay-ref" label="Reference" hint="Transaction ID, cheque or deposit slip no.">
            <Input id="pay-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
            <Wallet aria-hidden /> Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => billing.void(invoice.id ?? 0, reason),
    onSuccess: () => {
      toast.success(`${invoice.invoiceNo} cancelled`);
      onDone();
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {invoice.invoiceNo}?</DialogTitle>
          <DialogDescription>The school will not have to pay it. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <Field id="void-reason" label="Reason">
          <Textarea id="void-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep it</Button>
          <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** On a school's page: its plan (start, change, cancel) and invoices. */
export function SubscriptionCard({ schoolId }: { schoolId: number }) {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["platform", "billing", "school", schoolId], queryFn: () => billing.school(schoolId) });
  const [editing, setEditing] = useState(false);
  const cancel = useMutation({
    mutationFn: () => billing.cancel(schoolId),
    onSuccess: () => {
      toast.success("Subscription cancelled. No new invoices will be issued.");
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
    onError,
  });
  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const sub = data.data.subscription;
  const active = sub && sub.status === "ACTIVE";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" aria-hidden /> Subscription
          </CardTitle>
          <CardDescription>
            {active
              ? `${plan(sub.cycle)} · ${formatMoney(sub.amount)} · all students · next invoice for ${formatDate(sub.nextDueOn)} · ${sub.graceDays} grace days`
              : sub
                ? "Cancelled: no new invoices are issued."
                : "No plan yet. Starting one ends a free trial and issues the first invoice."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sub && <StandingBadge standing={sub.standing} />}
          {!editing && (
            <Button size="sm" onClick={() => setEditing(true)}>
              {active ? "Change plan" : sub ? "Restart plan" : "Start subscription"}
            </Button>
          )}
          {active && !editing && (
            <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel plan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing && <PlanForm schoolId={schoolId} current={active ? sub : undefined} onDone={() => setEditing(false)} />}
        <InvoiceTable invoices={data.data.invoices ?? []} />
      </CardContent>
    </Card>
  );
}

function PlanForm({ schoolId, current, onDone }: { schoolId: number; current?: Subscription; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState(current?.cycle ?? "MONTHLY");
  const [amount, setAmount] = useState(current ? String(Number(current.amount)) : "");
  const [startOn, setStartOn] = useState(todayPk());
  const [grace, setGrace] = useState(String(current?.graceDays ?? 10));
  const [notes, setNotes] = useState(current?.notes ?? "");
  const save = useMutation({
    mutationFn: () =>
      billing.saveSubscription(schoolId, {
        cycle,
        amount,
        startOn: current ? undefined : startOn,
        graceDays: Number(grace),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (r) => {
      const issued = (r.invoices ?? []).filter((i) => i.status === "UNPAID").length;
      toast.success(current ? "Plan changed. It applies to the next invoices." : `Subscription started${issued ? ": first invoice issued and emailed" : ""}.`);
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
      onDone();
    },
    onError,
  });
  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Billing</legend>
        <div className="flex gap-4 text-sm">
          {["MONTHLY", "YEARLY"].map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input type="radio" name="cycle" checked={cycle === c} onChange={() => setCycle(c)} />
              {plan(c)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="plan-amount" label={`Price per ${cycle === "YEARLY" ? "year" : "month"} (Rs.)`} hint="Any number of students">
        <Input id="plan-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {!current && (
        <Field id="plan-start" label="Starts on" hint="The first invoice is for this date">
          <Input id="plan-start" type="date" required value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        </Field>
      )}
      <Field id="plan-grace" label="Grace days" hint="Days after the due date before access pauses">
        <Input id="plan-grace" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />
      </Field>
      <Field id="plan-notes" label="Notes" className="sm:col-span-2 lg:col-span-4">
        <Input id="plan-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 20% discount agreed for the first year" />
      </Field>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={save.isPending || !amount.trim()}>
          {current ? "Save plan" : "Start subscription"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
