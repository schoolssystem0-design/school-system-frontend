"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { accounts, JOURNAL_TYPES } from "@/lib/api/accounts";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fromPaisa, isAmount, toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Daily cash summary and day close (FR 11.9), account ledgers (FR 11.3) and bank reconciliation (FR 11.10). */
export function DayPage() {
  const list = useQuery({ queryKey: ["accounts", "money", false], queryFn: () => accounts.moneyAccounts() });
  const [accountId, setAccountId] = useState<number | "">("");
  const chosen = accountId !== "" ? accountId : (list.data?.[0]?.id ?? "");
  const account = list.data?.find((a) => a.id === chosen);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Day book & close" description="What came in and went out of each account, and the end-of-day count." />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : (
        <>
          <Field id="day-account" label="Account" className="max-w-xs">
            <NativeSelect id="day-account" value={chosen} onChange={(e) => setAccountId(Number(e.target.value))}>
              {list.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect>
          </Field>
          {chosen !== "" && (
            <Tabs defaultValue="day" key={chosen}>
              <TabsList>
                <TabsTrigger value="day">Day summary</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                {account?.subtype === "BANK" && <TabsTrigger value="reconcile">Bank reconciliation</TabsTrigger>}
              </TabsList>
              <TabsContent value="day" className="mt-4"><Day accountId={chosen} /></TabsContent>
              <TabsContent value="ledger" className="mt-4"><Ledger accountId={chosen} /></TabsContent>
              {account?.subtype === "BANK" && (
                <TabsContent value="reconcile" className="mt-4"><Reconcile accountId={chosen} /></TabsContent>
              )}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}

function Day({ accountId }: { accountId: number }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const day = useQuery({ queryKey: ["accounts", "day", accountId, date], queryFn: () => accounts.day(accountId, date) });
  const closes = useQuery({ queryKey: ["accounts", "closes", accountId], queryFn: () => accounts.closes(accountId) });
  const close = useMutation({
    mutationFn: () => guard(() => accounts.closeDay(accountId, { date, counted, note: note.trim() || undefined })),
    onSuccess: () => {
      setCounted("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Day closed");
    },
    onError,
  });
  const difference = day.data && isAmount(counted, { allowZero: true }) ? toPaisa(counted) - toPaisa(day.data.closing) : null;
  return (
    <div className="flex flex-col gap-6">
      <Field id="day-date" label="Date" className="max-w-xs">
        <Input id="day-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {day.isPending ? (
        <Loading />
      ) : day.isError ? (
        <ErrorState error={day.error} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{day.data.accountName} on {formatDate(day.data.date)}</CardTitle>
            <CardDescription>
              Opening {formatMoney(day.data.opening)} · in {formatMoney(day.data.totalIn)} · out {formatMoney(day.data.totalOut)} ·
              closing <strong>{formatMoney(day.data.closing)}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(day.data.bySource ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded on this day.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {day.data.bySource?.map((r) => (
                    <TableRow key={r.source}>
                      <TableCell>{r.source}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.amountIn)}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.amountOut)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {day.data.close ? (
              <Alert>
                <AlertTitle>Day closed by {day.data.close.closedBy}</AlertTitle>
                <AlertDescription>
                  Counted {formatMoney(day.data.close.counted)} against {formatMoney(day.data.close.closing)}
                  {toPaisa(day.data.close.difference) !== 0n && <> (difference {formatMoney(day.data.close.difference)}: {day.data.close.note})</>}.
                  Nothing more can be recorded on this account for this day or earlier.
                </AlertDescription>
              </Alert>
            ) : (
              can(P.ACCOUNTS_DAY_CLOSE) && (
                <form className="flex flex-col gap-3 rounded-lg border p-4" onSubmit={(e) => { e.preventDefault(); close.mutate(); }}>
                  <p className="text-sm font-medium">Close the day</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field id="close-counted" label="Counted / statement amount (Rs.)">
                      <Input id="close-counted" required inputMode="decimal" className="w-48" value={counted} onChange={(e) => setCounted(e.target.value)} />
                    </Field>
                    {difference !== null && (
                      <p className={difference === 0n ? "text-sm text-emerald-700" : "text-sm text-destructive"} role="status">
                        {difference === 0n ? "Matches the books" : `Difference ${formatMoney(fromPaisa(difference))}`}
                      </p>
                    )}
                  </div>
                  {difference !== null && difference !== 0n && (
                    <Field id="close-note" label="Explain the difference">
                      <Textarea id="close-note" required rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                    </Field>
                  )}
                  <div>
                    <Button type="submit" disabled={!isAmount(counted, { allowZero: true }) || (difference !== 0n && !note.trim()) || close.isPending}>
                      Close day
                    </Button>
                  </div>
                </form>
              )
            )}
          </CardContent>
        </Card>
      )}
      {(closes.data ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent closes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Books</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closes.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.closing)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.counted)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.difference)}{c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}</TableCell>
                    <TableCell>{c.closedBy} <span className="block text-xs text-muted-foreground">{formatDateTime(c.closedAt)}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Ledger({ accountId }: { accountId: number }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [view, setView] = useState("DETAILED");
  const ledger = useQuery({ queryKey: ["accounts", "ledger", accountId, from, to, view], queryFn: () => accounts.ledger(accountId, from, to, view) });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="led-from" label="From"><Input id="led-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="led-to" label="To"><Input id="led-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field id="led-view" label="Show">
          <NativeSelect id="led-view" className="w-40" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="DETAILED">Every entry</option>
            <option value="DAILY">Totals per day</option>
            <option value="MONTHLY">Totals per month</option>
          </NativeSelect>
        </Field>
      </div>
      {ledger.isPending ? (
        <Loading />
      ) : ledger.isError ? (
        <ErrorState error={ledger.error} />
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>
              Opening {formatMoney(ledger.data.opening)} · in {formatMoney(ledger.data.totalIn)} · out {formatMoney(ledger.data.totalOut)} · closing{" "}
              <strong>{formatMoney(ledger.data.closing)}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(ledger.data.lines ?? []).length === 0 ? (
              <div className="p-6"><Empty title="Nothing in these dates" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.data.lines?.map((l, i) => (
                    <TableRow key={`${l.lineId ?? l.memo}-${i}`}>
                      <TableCell>{view === "MONTHLY" ? l.memo : formatDate(l.date)}</TableCell>
                      <TableCell>{JOURNAL_TYPES[l.type ?? ""] ?? l.type}</TableCell>
                      <TableCell className="max-w-80 truncate">{view === "DETAILED" ? l.memo : ""}</TableCell>
                      <TableCell className="text-right">{l.debit && toPaisa(l.debit) > 0n ? formatMoney(l.debit) : ""}</TableCell>
                      <TableCell className="text-right">{l.credit && toPaisa(l.credit) > 0n ? formatMoney(l.credit) : ""}</TableCell>
                      <TableCell className="text-right">{formatMoney(l.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Reconcile({ accountId }: { accountId: number }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const lines = useQuery({ queryKey: ["accounts", "uncleared", accountId], queryFn: () => accounts.uncleared(accountId) });
  const [selected, setSelected] = useState<number[]>([]);
  const [clearedOn, setClearedOn] = useState(today);
  const clear = useMutation({
    mutationFn: () => guard(() => accounts.clear(accountId, { lineIds: selected, clearedOn, cleared: true })),
    onSuccess: (r) => {
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${r.changed} entries marked as cleared`);
    },
    onError,
  });
  if (lines.isPending) return <Loading />;
  if (lines.isError) return <ErrorState error={lines.error} />;
  if (lines.data.length === 0) return <Empty title="Everything matches the bank statement" />;
  const manage = can(P.ACCOUNTS_RECONCILE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Not yet on the bank statement</CardTitle>
        <CardDescription>Tick the entries that appear on the statement (e.g. a cheque that has cleared).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {manage && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.data.map((l) => (
              <TableRow key={l.lineId}>
                {manage && (
                  <TableCell>
                    <Checkbox
                      aria-label={`Cleared: ${l.memo}`}
                      checked={selected.includes(l.lineId ?? 0)}
                      onCheckedChange={(c) => setSelected((ids) => (c ? [...ids, l.lineId ?? 0] : ids.filter((x) => x !== l.lineId)))}
                    />
                  </TableCell>
                )}
                <TableCell>{formatDate(l.date)}</TableCell>
                <TableCell className="max-w-80 truncate">{l.memo}</TableCell>
                <TableCell className="text-right">{l.debit ? formatMoney(l.debit) : ""}</TableCell>
                <TableCell className="text-right">{l.credit ? formatMoney(l.credit) : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {manage && (
          <div className="flex flex-wrap items-end gap-3 px-6 pb-6">
            <Field id="rec-date" label="Cleared on"><Input id="rec-date" type="date" value={clearedOn} onChange={(e) => setClearedOn(e.target.value)} /></Field>
            <Button disabled={selected.length === 0 || clear.isPending} onClick={() => clear.mutate()}>Mark {selected.length} as cleared</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
