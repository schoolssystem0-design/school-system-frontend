"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, fileUrl } from "@/lib/api/client";
import { accounts, ENTRY_KINDS, type Entry } from "@/lib/api/accounts";
import { newKey } from "@/lib/api/fees";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { Pager, today, UploadButton, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";

const onError = (e: unknown) => toast.error(errorMessage(e));

const kindLabel = (k?: string) => ENTRY_KINDS.find((x) => x.value === k)?.label ?? k;

function EntryStatus({ entry }: { entry: Entry }) {
  if (entry.reversesEntryId) return <Badge variant="secondary">Reversal</Badge>;
  if (entry.reversedByEntryId) return <Badge variant="secondary">Reversed</Badge>;
  if (entry.status === "PENDING") return <Badge variant="outline">Waiting for approval</Badge>;
  if (entry.status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge>Recorded</Badge>;
}

/** Income, expenses, transfers and supplier entries (FR 11.2, 11.4, 11.5, 11.7, 11.11). */
export function EntriesPage() {
  const can = useCan();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Entry | null>(null);
  const params = { kind, status, from, to, q, page };
  const list = useQuery({ queryKey: ["accounts", "entries", params], queryFn: () => accounts.entries(params) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Income & expenses"
        description="Money other than fees. Large expenses wait for approval; mistakes are reversed, never deleted."
        actions={
          can(P.ACCOUNTS_ENTRY_ADD) && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden /> New entry
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ent-kind" label="Type">
          <NativeSelect id="ent-kind" className="w-44" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
            <option value="">All</option>
            {ENTRY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </NativeSelect>
        </Field>
        <Field id="ent-status" label="Status">
          <NativeSelect id="ent-status" className="w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All</option>
            <option value="PENDING">Waiting for approval</option>
            <option value="APPROVED">Recorded</option>
            <option value="REJECTED">Rejected</option>
          </NativeSelect>
        </Field>
        <Field id="ent-from" label="From">
          <Input id="ent-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="ent-to" label="To">
          <Input id="ent-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field id="ent-q" label="Search">
          <Input id="ent-q" className="w-48" placeholder="Entry no., description" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6"><Empty title="No entries in these dates" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setOpen(e)}>
                        {e.entryNo}
                      </button>
                    </TableCell>
                    <TableCell>{formatDate(e.entryDate)}</TableCell>
                    <TableCell>{kindLabel(e.kind)}</TableCell>
                    <TableCell className="max-w-72">
                      {e.categoryName ?? (e.kind === "TRANSFER" ? `${e.accountName} → ${e.toAccountName}` : e.vendorName)}
                      {e.description && <span className="block truncate text-xs text-muted-foreground">{e.description}</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(e.amount)}</TableCell>
                    <TableCell><EntryStatus entry={e} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
      {adding && <NewEntryDialog onClose={() => setAdding(false)} />}
      {open && <EntryDialog entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function NewEntryDialog({ onClose }: { onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const moneyAccounts = useQuery({ queryKey: ["accounts", "money", false], queryFn: () => accounts.moneyAccounts() });
  const categories = useQuery({ queryKey: ["accounts", "categories"], queryFn: () => accounts.categories() });
  const vendors = useQuery({ queryKey: ["accounts", "vendors"], queryFn: accounts.vendors });
  const [kind, setKind] = useState("EXPENSE");
  const [entryDate, setEntryDate] = useState(today);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [toAccountId, setToAccountId] = useState<number | "">("");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<{ id: number; name: string } | null>(null);
  const needsCategory = ["INCOME", "EXPENSE", "PURCHASE"].includes(kind);
  const needsAccount = kind !== "PURCHASE";
  const needsVendor = kind === "PURCHASE" || kind === "VENDOR_PAYMENT";
  const categoryKind = kind === "INCOME" ? "INCOME" : "EXPENSE";
  const body = {
    kind,
    entryDate,
    categoryId: needsCategory && categoryId !== "" ? categoryId : undefined,
    accountId: needsAccount && accountId !== "" ? accountId : undefined,
    toAccountId: kind === "TRANSFER" && toAccountId !== "" ? toAccountId : undefined,
    vendorId: needsVendor && vendorId !== "" ? vendorId : undefined,
    amount,
    reference: reference.trim() || undefined,
    description: description.trim() || undefined,
    attachmentFileId: attachment?.id,
  };
  const bodyKey = JSON.stringify(body);
  const key = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => guard(() => accounts.createEntry(body, key)),
    onSuccess: (e) => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(e.status === "PENDING" ? `${e.entryNo} saved; it waits for approval` : `${e.entryNo} recorded`);
      onClose();
    },
    onError,
  });
  const ready =
    isAmount(amount) &&
    (!needsCategory || categoryId !== "") &&
    (!needsAccount || accountId !== "") &&
    (!needsVendor || vendorId !== "") &&
    (kind !== "TRANSFER" || (toAccountId !== "" && toAccountId !== accountId));
  const accountOptions = (moneyAccounts.data ?? []).map((a) => (
    <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>
  ));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New entry</DialogTitle>
            <DialogDescription>Fee receipts and salaries are recorded automatically; do not enter them here.</DialogDescription>
          </DialogHeader>
          <Field id="ne-kind" label="Type">
            <NativeSelect id="ne-kind" value={kind} onChange={(e) => { setKind(e.target.value); setCategoryId(""); }}>
              {ENTRY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </NativeSelect>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ne-date" label="Date">
              <Input id="ne-date" type="date" required max={today()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field id="ne-amount" label="Amount (Rs.)">
              <Input id="ne-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            {needsCategory && (
              <Field id="ne-cat" label="Category">
                <NativeSelect id="ne-cat" required value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Choose</option>
                  {(categories.data ?? [])
                    .filter((c) => c.kind === categoryKind && c.status === "ACTIVE" && !c.systemCode)
                    .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {needsVendor && (
              <Field id="ne-vendor" label="Supplier">
                <NativeSelect id="ne-vendor" required value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Choose</option>
                  {(vendors.data ?? []).filter((v) => v.status === "ACTIVE").map((v) => (
                    <option key={v.id} value={v.id}>{v.name} (owed {formatMoney(v.balance)})</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {needsAccount && (
              <Field id="ne-acc" label={kind === "TRANSFER" ? "From account" : kind === "INCOME" ? "Received into" : "Paid from"}>
                <NativeSelect id="ne-acc" required value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Choose</option>
                  {accountOptions}
                </NativeSelect>
              </Field>
            )}
            {kind === "TRANSFER" && (
              <Field id="ne-to" label="To account">
                <NativeSelect id="ne-to" required value={toAccountId} onChange={(e) => setToAccountId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Choose</option>
                  {accountOptions}
                </NativeSelect>
              </Field>
            )}
            <Field id="ne-ref" label="Reference" hint="Bill, cheque or slip number">
              <Input id="ne-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field id="ne-desc" label="Description">
              <Input id="ne-desc" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <UploadButton
              purpose="ACCOUNT_DOCUMENT"
              accept="application/pdf,image/png,image/jpeg"
              label={attachment ? "Replace attachment" : "Attach bill or receipt"}
              onUploaded={(id, name) => setAttachment({ id, name })}
            />
            {attachment && <span className="text-muted-foreground">{attachment.name}</span>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || save.isPending}>{save.isPending ? "Saving…" : "Save entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"reject" | "reverse" | null>(null);
  const done = (message: string) => () => {
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    toast.success(message);
    onClose();
  };
  const approve = useMutation({ mutationFn: () => guard(() => accounts.approveEntry(entry.id ?? 0)), onSuccess: done("Approved and recorded"), onError });
  const reject = useMutation({ mutationFn: (note: string) => guard(() => accounts.rejectEntry(entry.id ?? 0, note)), onSuccess: done("Rejected"), onError });
  const reverse = useMutation({ mutationFn: (reason: string) => guard(() => accounts.reverseEntry(entry.id ?? 0, reason)), onSuccess: done("Reversed"), onError });
  const approver = can(P.ACCOUNTS_ENTRY_APPROVE);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry.entryNo}: {kindLabel(entry.kind)}</DialogTitle>
          <DialogDescription>{formatMoney(entry.amount)} on {formatDate(entry.entryDate)}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          {entry.categoryName && (<><dt className="text-muted-foreground">Category</dt><dd>{entry.categoryName}</dd></>)}
          {entry.vendorName && (<><dt className="text-muted-foreground">Supplier</dt><dd>{entry.vendorName}</dd></>)}
          {entry.accountName && (<><dt className="text-muted-foreground">{entry.kind === "TRANSFER" ? "From" : "Account"}</dt><dd>{entry.accountName}</dd></>)}
          {entry.toAccountName && (<><dt className="text-muted-foreground">To</dt><dd>{entry.toAccountName}</dd></>)}
          {entry.reference && (<><dt className="text-muted-foreground">Reference</dt><dd>{entry.reference}</dd></>)}
          {entry.description && (<><dt className="text-muted-foreground">Description</dt><dd>{entry.description}</dd></>)}
          <dt className="text-muted-foreground">Entered by</dt><dd>{entry.createdBy} · {formatDateTime(entry.createdAt)}</dd>
          {entry.decidedBy && (<><dt className="text-muted-foreground">{entry.status === "REJECTED" ? "Rejected by" : "Approved by"}</dt><dd>{entry.decidedBy}{entry.decisionNote ? ` (${entry.decisionNote})` : ""}</dd></>)}
          {entry.reversalReason && (<><dt className="text-muted-foreground">Reversal reason</dt><dd>{entry.reversalReason}</dd></>)}
          {entry.journalEntryId && (<><dt className="text-muted-foreground">Journal entry</dt><dd>#{entry.journalEntryId}</dd></>)}
          {entry.attachmentFileId && (<><dt className="text-muted-foreground">Attachment</dt><dd><a className="underline" href={fileUrl(entry.attachmentFileId) ?? "#"} target="_blank" rel="noreferrer">Open</a></dd></>)}
        </dl>
        <DialogFooter>
          {approver && entry.status === "PENDING" && (
            <>
              <Button variant="outline" onClick={() => setAction("reject")}>Reject</Button>
              <Button disabled={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
            </>
          )}
          {approver && entry.status === "APPROVED" && !entry.reversesEntryId && !entry.reversedByEntryId && (
            <Button variant="destructive" onClick={() => setAction("reverse")}>Reverse</Button>
          )}
        </DialogFooter>
        <ConfirmDialog
          open={action != null}
          onOpenChange={(o) => !o && setAction(null)}
          title={action === "reject" ? "Reject this entry?" : `Reverse ${entry.entryNo}?`}
          description={action === "reverse" ? "A reversal entry dated today is added; both stay on record." : undefined}
          confirmLabel={action === "reject" ? "Reject" : "Reverse"}
          destructive
          requireReason
          pending={reject.isPending || reverse.isPending}
          onConfirm={(reason) => (action === "reject" ? reject.mutate(reason) : reverse.mutate(reason))}
        />
      </DialogContent>
    </Dialog>
  );
}
