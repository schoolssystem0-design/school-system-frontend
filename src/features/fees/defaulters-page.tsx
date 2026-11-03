"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { fees, newKey } from "@/lib/api/fees";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { ClassSelect, Pager, SectionSelect, useCan } from "@/features/people/shared";
import { Balance, BillStatus } from "./fee-shared";
import { ExportBar } from "@/features/reports/export-bar";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Fee status per student (FR 10.15) and defaulters with reminders and follow-up (FR 10.16). */
export function DefaultersPage() {
  const can = useCan();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fee status & defaulters" description="Who has paid, who owes, and the follow-up with each family." />
      <ExportBar title="Fee status and defaulters" />
      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Fee status</TabsTrigger>
          {can(P.FEES_REPORTS_VIEW) && <TabsTrigger value="defaulters">Defaulters</TabsTrigger>}
          <TabsTrigger value="messages">Messages sent</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="mt-4">
          <FeeStatus />
        </TabsContent>
        {can(P.FEES_REPORTS_VIEW) && (
          <TabsContent value="defaulters" className="mt-4">
            <Defaulters />
          </TabsContent>
        )}
        <TabsContent value="messages" className="mt-4">
          <Messages />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeeStatus() {
  const can = useCan();
  const canCollect = can(P.FEES_PAYMENT_ADD);
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const params = { classId: classId || undefined, sectionId: sectionId || undefined, status, q, page };
  const list = useQuery({ queryKey: ["fees", "status", params], queryFn: () => fees.status(params) });
  const reset = () => setPage(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="st-q" label="Search">
          <Input id="st-q" className="w-56" placeholder="Student, GR, father, family no." value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </Field>
        <Field id="st-cls" label="Class">
          <ClassSelect id="st-cls" className="w-36" value={classId} onChange={(v) => { setClassId(v); setSectionId(""); reset(); }} />
        </Field>
        <Field id="st-sec" label="Section">
          <SectionSelect id="st-sec" className="w-40" classId={classId} emptyLabel="All sections" value={sectionId} onChange={(v) => { setSectionId(v); reset(); }} />
        </Field>
        <Field id="st-st" label="Status">
          <NativeSelect id="st-st" className="w-36" value={status} onChange={(e) => { setStatus(e.target.value); reset(); }}>
            <option value="">All</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Part paid</option>
            <option value="PAID">Paid</option>
          </NativeSelect>
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
              <Empty title="No students" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead className="text-right">Charged this year</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Owed (all years)</TableHead>
                  <TableHead>Oldest due</TableHead>
                  <TableHead>Status</TableHead>
                  {canCollect && <TableHead className="w-28" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/students/${s.studentId}`}>
                        {s.studentName}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">GR {s.grNo}</span>
                    </TableCell>
                    <TableCell>
                      {s.className} - {s.sectionName}
                    </TableCell>
                    <TableCell>
                      {s.fatherName} <span className="text-xs text-muted-foreground">{s.familyNo}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(s.charged)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.paid)}</TableCell>
                    <TableCell className="text-right">
                      <Balance value={s.balance} />
                    </TableCell>
                    <TableCell>{s.oldestDue ? formatDate(s.oldestDue) : "—"}</TableCell>
                    <TableCell>
                      <BillStatus status={s.status} />
                    </TableCell>
                    {canCollect && (
                      <TableCell>
                        {s.familyId != null && s.status !== "PAID" && (
                          <Button size="sm" variant="outline" render={<Link href={`/app/fees/collect?familyId=${s.familyId}`} />}>
                            Collect
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
    </div>
  );
}

function Defaulters() {
  const can = useCan();
  const [minBalance, setMinBalance] = useState("");
  const [minDays, setMinDays] = useState("");
  const [classId, setClassId] = useState<number | "">("");
  const [selected, setSelected] = useState<number[]>([]);
  const [reminding, setReminding] = useState(false);
  const [followUp, setFollowUp] = useState<Schemas["DefaulterRow"] | null>(null);
  const params = {
    minBalance: isAmount(minBalance) ? minBalance : undefined,
    minDaysOverdue: minDays ? Number(minDays) : undefined,
    classId: classId || undefined,
  };
  const list = useQuery({ queryKey: ["fees", "defaulters", params], queryFn: () => fees.defaulters(params) });
  const letter = useMutation({
    mutationFn: (familyId: number) => fees.finalReminder(familyId),
    onSuccess: (b) => openBlob(b, "final-reminder.pdf"),
    onError,
  });
  const rows = list.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.familyId ?? 0));
  const remind = can(P.FEES_REMINDERS_SEND);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="def-min" label="Owing at least (Rs.)">
          <Input id="def-min" className="w-36" inputMode="decimal" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} />
        </Field>
        <Field id="def-days" label="Overdue for at least (days)">
          <Input id="def-days" className="w-32" inputMode="numeric" value={minDays} onChange={(e) => setMinDays(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field id="def-class" label="Child in class">
          <ClassSelect id="def-class" className="w-36" value={classId} onChange={setClassId} />
        </Field>
        {remind && (
          <Button disabled={selected.length === 0} onClick={() => setReminding(true)}>
            <MessageSquare aria-hidden /> Send reminder ({selected.length})
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <Empty title="No defaulters with these filters" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {remind && (
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all"
                        checked={allSelected}
                        onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.familyId ?? 0) : [])}
                      />
                    </TableHead>
                  )}
                  <TableHead>Family</TableHead>
                  <TableHead>Children</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Oldest due</TableHead>
                  <TableHead>Last payment</TableHead>
                  <TableHead>Last follow-up</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.familyId}>
                    {remind && (
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${r.fatherName}`}
                          checked={selected.includes(r.familyId ?? 0)}
                          onCheckedChange={(c) =>
                            setSelected((ids) => (c ? [...ids, r.familyId ?? 0] : ids.filter((x) => x !== r.familyId)))
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/families/${r.familyId}`}>
                        {r.familyNo}
                      </Link>{" "}
                      {r.fatherName}
                      <span className="block text-xs text-muted-foreground">{r.fatherPhone}</span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{r.children}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(r.balance)}</TableCell>
                    <TableCell>
                      {formatDate(r.oldestDue)} <span className="block text-xs text-muted-foreground">{r.monthsDue} month(s)</span>
                    </TableCell>
                    <TableCell>{r.lastPayment ? formatDate(r.lastPayment) : "Never"}</TableCell>
                    <TableCell className="max-w-56">
                      <span className="line-clamp-2">{r.lastFollowUp ?? "—"}</span>
                      {r.nextFollowUp && <span className="block text-xs text-muted-foreground">next {formatDate(r.nextFollowUp)}</span>}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {can(P.FEES_PAYMENT_ADD) && (
                        <Button size="sm" variant="ghost" render={<Link href={`/app/fees/collect?familyId=${r.familyId}`} />}>
                          Collect
                        </Button>
                      )}
                      {remind && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setFollowUp(r)}>
                            Follow-up
                          </Button>
                          <Button size="sm" variant="ghost" disabled={letter.isPending} onClick={() => letter.mutate(r.familyId ?? 0)}>
                            <FileDown aria-hidden /> Letter
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {reminding && <ReminderDialog familyIds={selected} onClose={() => setReminding(false)} onSent={() => setSelected([])} />}
      {followUp && <FollowUpDialog familyId={followUp.familyId ?? 0} title={`${followUp.familyNo} ${followUp.fatherName ?? ""}`} onClose={() => setFollowUp(null)} />}
    </div>
  );
}

function ReminderDialog({ familyIds, onClose, onSent }: { familyIds: number[]; onClose: () => void; onSent: () => void }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const body = { familyIds, message: message.trim() || undefined };
  const bodyKey = JSON.stringify(body);
  const key = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({
    mutationFn: () => fees.remind(body, key),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success(
        `${r.queued} reminders queued` +
          (r.noPhone ? `, ${r.noPhone} without a phone number` : "") +
          (r.alreadyQueued ? `, ${r.alreadyQueued} already sent` : ""),
      );
      onSent();
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send fee reminder to {familyIds.length} families</DialogTitle>
          <DialogDescription>
            Each family gets one SMS with its own amount. Leave the message empty for the standard text. You can use {"{name}"},{" "}
            {"{amount}"} and {"{school}"}.
          </DialogDescription>
        </DialogHeader>
        <Field id="rem-msg" label="Message (optional)">
          <Textarea id="rem-msg" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FollowUpDialog({ familyId, title, onClose }: { familyId: number; title: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["fees", "follow-ups", familyId], queryFn: () => fees.followUps(familyId) });
  const [remark, setRemark] = useState("");
  const [nextDate, setNextDate] = useState("");
  const add = useMutation({
    mutationFn: () => fees.addFollowUp(familyId, { remark, nextDate: nextDate || undefined }),
    onSuccess: () => {
      setRemark("");
      setNextDate("");
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-up: {title}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Field id="fu-remark" label="What was discussed">
            <Textarea id="fu-remark" required rows={2} maxLength={1000} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
          <Field id="fu-next" label="Next follow-up (optional)">
            <Input id="fu-next" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" size="sm" disabled={!remark.trim() || add.isPending}>
              Save follow-up
            </Button>
          </div>
        </form>
        {list.isPending ? (
          <Loading />
        ) : (
          <ol className="flex flex-col gap-2">
            {(list.data ?? []).map((f) => (
              <li key={f.id} className="border-s-2 ps-3 text-sm">
                <p>{f.remark}</p>
                <p className="text-xs text-muted-foreground">
                  {f.createdBy} · {formatDateTime(f.createdAt)}
                  {f.nextDate && ` · next ${formatDate(f.nextDate)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Messages() {
  const [status, setStatus] = useState("");
  const list = useQuery({ queryKey: ["fees", "messages", status], queryFn: () => fees.messages(status) });
  return (
    <div className="flex flex-col gap-4">
      <Field id="msg-status" label="Status" className="max-w-xs">
        <NativeSelect id="msg-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="PENDING">Waiting to send</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </NativeSelect>
      </Field>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} />
          ) : (list.data ?? []).length === 0 ? (
            <div className="p-6">
              <Empty title="No messages" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>{m.recipient}</TableCell>
                    <TableCell>{m.purpose === "FEE_RECEIPT" ? "Receipt" : "Reminder"}</TableCell>
                    <TableCell className="max-w-96 whitespace-normal">{m.body}</TableCell>
                    <TableCell>
                      {m.status === "SENT" ? "Sent" : m.status === "FAILED" ? "Failed" : "Waiting"}
                      {m.lastError && <span className="block text-xs text-destructive">{m.lastError} ({m.attempts} tries)</span>}
                    </TableCell>
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
