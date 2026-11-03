"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fees } from "@/lib/api/fees";
import { formatDate, formatMoney } from "@/lib/format";
import { fromPaisa, sumPaisa } from "@/lib/money";
import { today } from "@/features/people/shared";
import { ExportBar } from "@/features/reports/export-bar";

/** Fee reports (FR 10.17, 10.4). */
export function FeeReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fee reports" description="All figures are worked out from bills, corrections and payments." />
      <ExportBar title="Fee reports" />
      <Tabs defaultValue="heads">
        <TabsList className="flex-wrap">
          <TabsTrigger value="heads">By fee head</TabsTrigger>
          <TabsTrigger value="collections">Money received</TabsTrigger>
          <TabsTrigger value="families">Family receivables</TabsTrigger>
          <TabsTrigger value="credits">Advances held</TabsTrigger>
          <TabsTrigger value="writeoffs">Bad debts</TabsTrigger>
          <TabsTrigger value="siblings">Missing sibling discounts</TabsTrigger>
        </TabsList>
        <TabsContent value="heads" className="mt-4">
          <HeadReport received={false} />
        </TabsContent>
        <TabsContent value="collections" className="mt-4">
          <HeadReport received />
        </TabsContent>
        <TabsContent value="families" className="mt-4">
          <FamilyReceivables />
        </TabsContent>
        <TabsContent value="credits" className="mt-4">
          <Credits />
        </TabsContent>
        <TabsContent value="writeoffs" className="mt-4">
          <WriteOffs />
        </TabsContent>
        <TabsContent value="siblings" className="mt-4">
          <MissingSiblings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeadReport({ received }: { received: boolean }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const report = useQuery({
    queryKey: ["fees", "report", received ? "collections" : "heads", from, to],
    queryFn: () => (received ? fees.collectionReport(from, to) : fees.headReport(from, to)),
  });
  const rows = report.data ?? [];
  const total = (key: "charged" | "discount" | "collected" | "outstanding") => fromPaisa(sumPaisa(rows.map((r) => r[key])));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {received
          ? "Money settled against each fee head in these dates (matches fee income in the accounts)."
          : "Bills issued in these dates: charged, discount, collected so far and still outstanding."}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field id={`rep-from-${received}`} label="From">
          <Input id={`rep-from-${received}`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id={`rep-to-${received}`} label="To">
          <Input id={`rep-to-${received}`} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {report.isPending ? (
            <Loading />
          ) : report.isError ? (
            <ErrorState error={report.error} onRetry={() => report.refetch()} />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <Empty title="Nothing in these dates" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee head</TableHead>
                  {!received && <TableHead className="text-right">Charged</TableHead>}
                  {!received && <TableHead className="text-right">Discount</TableHead>}
                  <TableHead className="text-right">{received ? "Received" : "Collected"}</TableHead>
                  {!received && <TableHead className="text-right">Outstanding</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.feeHeadId}>
                    <TableCell>{r.headName}</TableCell>
                    {!received && <TableCell className="text-right">{formatMoney(r.charged)}</TableCell>}
                    {!received && <TableCell className="text-right">{formatMoney(r.discount)}</TableCell>}
                    <TableCell className="text-right">{formatMoney(r.collected)}</TableCell>
                    {!received && <TableCell className="text-right">{formatMoney(r.outstanding)}</TableCell>}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  {!received && <TableCell className="text-right">{formatMoney(total("charged"))}</TableCell>}
                  {!received && <TableCell className="text-right">{formatMoney(total("discount"))}</TableCell>}
                  <TableCell className="text-right">{formatMoney(total("collected"))}</TableCell>
                  {!received && <TableCell className="text-right">{formatMoney(total("outstanding"))}</TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FamilyReceivables() {
  const report = useQuery({ queryKey: ["fees", "report", "family-receivables"], queryFn: fees.familyReceivables });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (report.data.length === 0) return <Empty title="No family owes anything" />;
  const months = [...new Set(report.data.flatMap((r) => Object.keys(r.byPeriod ?? {})))].sort();
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Family</TableHead>
              {months.map((m) => (
                <TableHead key={m} className="text-right">
                  {m}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.data.map((r) => (
              <TableRow key={r.familyId}>
                <TableCell>
                  <Link className="underline-offset-4 hover:underline" href={`/app/families/${r.familyId}`}>
                    {r.familyNo}
                  </Link>{" "}
                  {r.fatherName}
                </TableCell>
                {months.map((m) => (
                  <TableCell key={m} className="text-right">
                    {r.byPeriod?.[m] ? formatMoney(r.byPeriod[m]) : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">{formatMoney(r.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Credits() {
  const report = useQuery({ queryKey: ["fees", "report", "credits"], queryFn: fees.credits });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (report.data.length === 0) return <Empty title="No advance payments are held" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Family</TableHead>
              <TableHead className="text-right">Advance held</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.data.map((r) => (
              <TableRow key={r.familyId}>
                <TableCell>
                  <Link className="underline-offset-4 hover:underline" href={`/app/families/${r.familyId}`}>
                    {r.familyNo}
                  </Link>{" "}
                  {r.fatherName}
                </TableCell>
                <TableCell className="text-right">{formatMoney(r.credit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WriteOffs() {
  const report = useQuery({ queryKey: ["fees", "report", "write-offs"], queryFn: () => fees.writeOffs("BAD_DEBT") });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (report.data.length === 0) return <Empty title="No bad debts written off" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead className="text-right">Written off</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Approved by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.data.map((r) => (
              <TableRow key={r.adjustmentId}>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>
                  {r.studentName} <span className="text-xs text-muted-foreground">GR {r.grNo}</span>
                </TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell className="text-right">{formatMoney(r.amount?.replace("-", ""))}</TableCell>
                <TableCell className="max-w-56">{r.reason}</TableCell>
                <TableCell>{r.approvedBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MissingSiblings() {
  const report = useQuery({ queryKey: ["fees", "report", "missing-siblings"], queryFn: fees.missingSiblingDiscounts });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (report.data.length === 0)
    return <Empty title="Every brother or sister who qualifies got a discount on their latest bill" />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Child no.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.data.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell>
                  <Link className="underline-offset-4 hover:underline" href={`/app/students/${r.studentId}`}>
                    {r.studentName}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">GR {r.grNo}</span>
                </TableCell>
                <TableCell>{r.className}</TableCell>
                <TableCell>{r.familyNo}</TableCell>
                <TableCell>{r.childOrder}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
