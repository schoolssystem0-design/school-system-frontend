"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, FileDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { errorMessage, openBlob } from "@/lib/api/client";
import { school, type Invoice } from "@/lib/api/business";
import { formatDate, formatMoney } from "@/lib/format";

const SUBSCRIPTION_KEY = ["subscription"];

function useSubscription() {
  return useQuery({ queryKey: SUBSCRIPTION_KEY, queryFn: school.subscription, staleTime: 10 * 60_000, retry: false });
}

function useInvoicePdf() {
  return useMutation({
    mutationFn: (i: Invoice) => school.invoicePdf(i.id ?? 0).then((blob) => openBlob(blob, `${i.invoiceNo}.pdf`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** A line above the portal while the school has an unpaid Tirvex Tech invoice. Shows nothing otherwise (or offline). */
export function SubscriptionBanner() {
  const q = useSubscription();
  const pdf = useInvoicePdf();
  const s = q.data;
  if (!s || (s.standing !== "DUE" && s.standing !== "OVERDUE")) return null;
  const open = s.openInvoices ?? [];
  const first = open[0];
  const overdue = s.standing === "OVERDUE";
  const pausesOn = open.map((i) => i.pausesOn).filter(Boolean).sort()[0];
  return (
    <div
      role="status"
      className={
        "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-sm print:hidden " +
        (overdue ? "bg-destructive text-white" : "bg-highlight text-highlight-foreground")
      }
    >
      <Wallet className="size-4 shrink-0" aria-hidden />
      <span>
        <strong>{overdue ? "Subscription overdue:" : "Subscription invoice due:"}</strong>{" "}
        {first?.amount ? `${formatMoney(first.amount)} ` : ""}
        {first?.dueOn ? `due ${formatDate(first.dueOn)}.` : ""}
        {pausesOn ? ` Access pauses on ${formatDate(pausesOn)} if unpaid; your data is kept.` : ""}
      </span>
      {first?.id != null && first.amount && (
        <Button size="xs" variant="secondary" disabled={pdf.isPending} onClick={() => pdf.mutate(first)}>
          <FileDown aria-hidden /> Invoice
        </Button>
      )}
    </div>
  );
}

/** Reports, Subscription (administrators): the plan, unpaid invoices and how to pay. */
export function SubscriptionPanel() {
  const q = useSubscription();
  const pdf = useInvoicePdf();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  if (!s.standing) return <Empty title="No subscription yet">Contact Tirvex Tech to start your plan. There is no limit on students.</Empty>;
  const open = s.openInvoices ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" aria-hidden /> Your plan
            </CardTitle>
            <CardDescription>
              {s.standing === "CANCELLED"
                ? "Cancelled"
                : `${s.cycle === "YEARLY" ? "Yearly" : "Monthly"}${s.amount ? ` · ${formatMoney(s.amount)}` : ""} · any number of students · next period from ${formatDate(s.nextDueOn)}`}
            </CardDescription>
          </div>
          <Badge variant={s.standing === "PAID_UP" ? "default" : "destructive"}>
            {{ PAID_UP: "Paid up", DUE: "Invoice due", OVERDUE: "Overdue", PAUSED: "Paused", CANCELLED: "Cancelled" }[s.standing] ?? s.standing}
          </Badge>
        </CardHeader>
        {s.paymentDetails && (
          <CardContent>
            <p className="text-sm font-medium">How to pay</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{s.paymentDetails}</p>
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Unpaid invoices</CardTitle>
          <CardDescription>Once Tirvex Tech receives your payment, the invoice is marked paid and a receipt is emailed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {open.length === 0 && <p className="text-sm text-muted-foreground">Nothing to pay. Thank you!</p>}
          {open.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="text-sm">
                <p className="font-medium">
                  {i.invoiceNo} · {formatMoney(i.amount)}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(i.periodStart)} – {formatDate(i.periodEnd)} · due {formatDate(i.dueOn)}
                  {i.pausesOn ? ` · access pauses ${formatDate(i.pausesOn)}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={pdf.isPending} onClick={() => pdf.mutate(i)}>
                <FileDown aria-hidden /> Download
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
