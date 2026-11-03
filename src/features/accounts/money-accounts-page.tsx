"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { accounts, type Category, type MoneyAccount, type Vendor } from "@/lib/api/accounts";
import { formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { today, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Cash and bank accounts (FR 11.1), income/expense categories (FR 11.6) and suppliers (FR 11.7). */
export function MoneyAccountsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cash & bank"
        description="Every rupee in or out is recorded against one of these accounts, including fee receipts and salaries."
      />
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="vendors">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <Accounts />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <Categories />
        </TabsContent>
        <TabsContent value="vendors" className="mt-4">
          <Vendors />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Accounts() {
  const can = useCan();
  const list = useQuery({ queryKey: ["accounts", "money", true], queryFn: () => accounts.moneyAccounts(true) });
  const [editing, setEditing] = useState<MoneyAccount | "new" | null>(null);
  const [opening, setOpening] = useState<MoneyAccount | null>(null);
  const manage = can(P.ACCOUNTS_MANAGE);
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Add an opening balance for money held before the system was used.</CardDescription>
        </div>
        {manage && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add account
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              {manage && <TableHead><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.code}</TableCell>
                <TableCell className="font-medium">
                  {a.name}
                  {a.bankDetails && <span className="block text-xs text-muted-foreground">{a.bankDetails}</span>}
                </TableCell>
                <TableCell>{a.subtype === "CASH" ? "Cash" : "Bank"}</TableCell>
                <TableCell className="text-right">{formatMoney(a.balance)}</TableCell>
                <TableCell>
                  <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"}>{a.status === "ACTIVE" ? "Open" : "Closed"}</Badge>
                </TableCell>
                {manage && (
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                    {a.status === "ACTIVE" && (
                      <Button size="sm" variant="ghost" onClick={() => setOpening(a)}>
                        Opening balance
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {editing && <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {opening && <OpeningDialog account={opening} onClose={() => setOpening(null)} />}
    </Card>
  );
}

function AccountDialog({ account, onClose }: { account: MoneyAccount | null; onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [name, setName] = useState(account?.name ?? "");
  const [subtype, setSubtype] = useState(account?.subtype ?? "BANK");
  const [bankDetails, setBankDetails] = useState(account?.bankDetails ?? "");
  const [active, setActive] = useState(account ? account.status === "ACTIVE" : true);
  const [openingBalance, setOpeningBalance] = useState("");
  const save = useMutation({
    mutationFn: () =>
      guard(() =>
        account
          ? accounts.updateMoneyAccount(account.id ?? 0, { name, bankDetails: bankDetails || undefined, active })
          : accounts.createMoneyAccount({ name, subtype, bankDetails: bankDetails || undefined, openingBalance: openingBalance || undefined }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account saved");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>{account ? `Edit ${account.name}` : "Add account"}</DialogTitle>
          </DialogHeader>
          <Field id="acc-name" label="Name" hint="e.g. Meezan Bank – school account">
            <Input id="acc-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {!account && (
            <Field id="acc-type" label="Type">
              <NativeSelect id="acc-type" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
                <option value="BANK">Bank account</option>
                <option value="CASH">Cash box</option>
              </NativeSelect>
            </Field>
          )}
          <Field id="acc-bank" label="Bank details (optional)" hint="Branch, account number or IBAN">
            <Input id="acc-bank" maxLength={200} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} />
          </Field>
          {!account && (
            <Field id="acc-open" label="Opening balance (optional, Rs.)">
              <Input id="acc-open" inputMode="decimal" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </Field>
          )}
          {account && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Open (an account can be closed only when its balance is zero)
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || (openingBalance !== "" && !isAmount(openingBalance, { allowZero: true }))}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OpeningDialog({ account, onClose }: { account: MoneyAccount; onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const save = useMutation({
    mutationFn: () => guard(() => accounts.openingBalance(account.id ?? 0, { amount, date })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Opening balance recorded");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Opening balance: {account.name}</DialogTitle>
            <DialogDescription>Money the school already had in this account before using the system.</DialogDescription>
          </DialogHeader>
          <Field id="ob-amount" label="Amount (Rs.)">
            <Input id="ob-amount" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field id="ob-date" label="As on">
            <Input id="ob-date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!isAmount(amount) || save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Categories() {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["accounts", "categories"], queryFn: () => accounts.categories() });
  const [name, setName] = useState("");
  const [kind, setKind] = useState("EXPENSE");
  const create = useMutation({
    mutationFn: () => guard(() => accounts.createCategory({ name, kind })),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["accounts", "categories"] });
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (c: Category) => guard(() => accounts.updateCategory(c.id ?? 0, { name: c.name ?? "", active: c.status !== "ACTIVE" })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts", "categories"] }),
    onError,
  });
  const manage = can(P.ACCOUNTS_MANAGE);
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income and expense categories</CardTitle>
        <CardDescription>Reports group money by these. Salaries are paid through Payroll.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(["INCOME", "EXPENSE"] as const).map((k) => (
            <div key={k}>
              <h3 className="mb-2 text-sm font-medium">{k === "INCOME" ? "Income" : "Expenses"}</h3>
              <ul className="flex flex-col divide-y rounded-md border">
                {list.data.filter((c) => c.kind === k).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <span className="text-muted-foreground">{c.code}</span> {c.name}
                      {c.systemCode && <Badge variant="outline" className="ms-2">Payroll</Badge>}
                    </span>
                    {manage && !c.systemCode && (
                      <Switch aria-label={`${c.name} in use`} checked={c.status === "ACTIVE"} onCheckedChange={() => toggle.mutate(c)} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {manage && (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field id="cat-name" label="New category">
              <Input id="cat-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id="cat-kind" label="Type">
              <NativeSelect id="cat-kind" className="w-32" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </NativeSelect>
            </Field>
            <Button type="submit" disabled={!name.trim() || create.isPending}>Add</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Vendors() {
  const can = useCan();
  const list = useQuery({ queryKey: ["accounts", "vendors"], queryFn: accounts.vendors });
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>Owed = supplier bills recorded minus payments made.</CardDescription>
        </div>
        {can(P.ACCOUNTS_MANAGE) && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add supplier
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {list.data.length === 0 ? (
          <div className="p-6"><Empty title="No suppliers yet" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Status</TableHead>
                {can(P.ACCOUNTS_MANAGE) && <TableHead><span className="sr-only">Edit</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.name}
                    {v.address && <span className="block text-xs text-muted-foreground">{v.address}</span>}
                  </TableCell>
                  <TableCell>{v.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(v.balance)}</TableCell>
                  <TableCell>{v.status === "ACTIVE" ? "In use" : "Switched off"}</TableCell>
                  {can(P.ACCOUNTS_MANAGE) && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>Edit</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editing && <VendorDialog vendor={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function VendorDialog({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: vendor?.name ?? "",
    phone: vendor?.phone ?? "",
    address: vendor?.address ?? "",
    notes: vendor?.notes ?? "",
    active: vendor ? vendor.status === "ACTIVE" : true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined, active: form.active };
      return guard(() => (vendor ? accounts.updateVendor(vendor.id ?? 0, body) : accounts.createVendor(body)));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts", "vendors"] });
      toast.success("Supplier saved");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>{vendor ? `Edit ${vendor.name}` : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <Field id="ven-name" label="Name">
            <Input id="ven-name" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field id="ven-phone" label="Phone">
            <Input id="ven-phone" inputMode="tel" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field id="ven-address" label="Address">
            <Input id="ven-address" maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field id="ven-notes" label="Notes">
            <Input id="ven-notes" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {vendor && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /> In use
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
