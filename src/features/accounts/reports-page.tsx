"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Schemas } from "@/lib/api/client";
import { accounts } from "@/lib/api/accounts";
import { formatDateTime, formatMoney } from "@/lib/format";
import { fromPaisa, sumPaisa } from "@/lib/money";
import { Pager, today } from "@/features/people/shared";
import { ExportBar } from "@/features/reports/export-bar";

/** Financial reports (FR 11.13) and financial activity history (FR 11.12). */
export function AccountsReportsPage() {
  const [from, setFrom] = useState(() => `${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Financial reports" description="Worked out from the books: fees, other income, expenses and salaries." />
      <ExportBar title="Financial reports" />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="rep-from" label="From"><Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="rep-to" label="To (and balances as on)"><Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary">Income & expense</TabsTrigger>
          <TabsTrigger value="categories">By category</TabsTrigger>
          <TabsTrigger value="collection">Daily collection</TabsTrigger>
          <TabsTrigger value="balances">Balance sheet</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="activity">Activity history</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4"><Monthly from={from} to={to} /></TabsContent>
        <TabsContent value="categories" className="mt-4"><ByCategory from={from} to={to} /></TabsContent>
        <TabsContent value="collection" className="mt-4"><DailyCollection from={from} to={to} /></TabsContent>
        <TabsContent value="balances" className="mt-4"><BalanceSheet asOf={to} /></TabsContent>
        <TabsContent value="trial" className="mt-4"><TrialBalance asOf={to} /></TabsContent>
        <TabsContent value="activity" className="mt-4"><Activity from={from} to={to} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Monthly({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ["accounts", "report", "monthly", from, to], queryFn: () => accounts.monthly(from, to) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title="Nothing in these dates" />;
  const total = (k: "income" | "expense" | "net") => fromPaisa(sumPaisa(q.data.map((r) => r[k])));
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Surplus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((r) => (
              <TableRow key={r.month}>
                <TableCell>{r.month}</TableCell>
                <TableCell className="text-right">{formatMoney(r.income)}</TableCell>
                <TableCell className="text-right">{formatMoney(r.expense)}</TableCell>
                <TableCell className="text-right">{formatMoney(r.net)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatMoney(total("income"))}</TableCell>
              <TableCell className="text-right">{formatMoney(total("expense"))}</TableCell>
              <TableCell className="text-right">{formatMoney(total("net"))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ByCategory({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ["accounts", "report", "category", from, to], queryFn: () => accounts.byCategory(from, to) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title="Nothing in these dates" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["INCOME", "EXPENSE"] as const).map((kind) => {
        const rows = q.data.filter((r) => r.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader><CardTitle>{kind === "INCOME" ? "Income" : "Expenses"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatMoney(fromPaisa(sumPaisa(rows.map((r) => r.amount))))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DailyCollection({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ["accounts", "report", "daily", from, to], queryFn: () => accounts.dailyCollection(from, to) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.length === 0) return <Empty title="No money received in these dates" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Other income</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((r) => (
              <TableRow key={`${r.date}-${r.account}`}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.account}</TableCell>
                <TableCell className="text-right">{formatMoney(r.fees)}</TableCell>
                <TableCell className="text-right">{formatMoney(r.otherIncome)}</TableCell>
                <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right">{formatMoney(fromPaisa(sumPaisa(q.data.map((r) => r.total))))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Rows({ title, rows, total }: { title: string; rows: Schemas["BalanceRow"][]; total?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell><span className="text-muted-foreground">{r.code}</span> {r.name}</TableCell>
                <TableCell className="text-right">{formatMoney(r.balance)}</TableCell>
              </TableRow>
            ))}
            {total && (
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatMoney(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BalanceSheet({ asOf }: { asOf: string }) {
  const q = useQuery({ queryKey: ["accounts", "report", "bs", asOf], queryFn: () => accounts.balanceSheet(asOf) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  const b = q.data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Rows title="What the school has (assets)" rows={b.assets ?? []} total={b.totalAssets} />
      <div className="flex flex-col gap-6">
        <Rows title="What the school owes (liabilities)" rows={b.liabilities ?? []} total={b.totalLiabilities} />
        <Rows title="Opening balances and capital" rows={b.equity ?? []} total={b.totalEquity} />
        <Card>
          <CardContent className="flex justify-between pt-6 text-sm font-semibold">
            <span>Surplus so far (income − expenses)</span>
            <span>{formatMoney(b.surplus)}</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrialBalance({ asOf }: { asOf: string }) {
  const q = useQuery({ queryKey: ["accounts", "report", "tb", asOf], queryFn: () => accounts.trialBalance(asOf) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  const debit = sumPaisa(q.data.map((r) => r.debit));
  const credit = sumPaisa(q.data.map((r) => r.credit));
  return (
    <div className="flex flex-col gap-4">
      <Alert variant={debit === credit ? "default" : "destructive"}>
        <AlertDescription>
          {debit === credit ? "The books balance: total debits equal total credits." : "The books do not balance. Contact support."}
        </AlertDescription>
      </Alert>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell><span className="text-muted-foreground">{r.code}</span> {r.name}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.debit)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.credit)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatMoney(fromPaisa(debit))}</TableCell>
                <TableCell className="text-right">{formatMoney(fromPaisa(credit))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Activity({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["accounts", "activity", from, to, page], queryFn: () => accounts.activity(from, to, page) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (q.data.items.length === 0) return <Empty title="No financial activity in these dates" />;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDateTime(a.at)}</TableCell>
                  <TableCell>{a.actor}</TableCell>
                  <TableCell>{(a.action ?? "").toLowerCase().replaceAll("_", " ")} <span className="text-xs text-muted-foreground">#{a.entityId}</span></TableCell>
                  <TableCell className="max-w-64 truncate">{a.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pager page={page} totalPages={q.data.totalPages} onChange={setPage} />
    </div>
  );
}
