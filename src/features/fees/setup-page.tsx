"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { fees, FREQUENCIES, type FeeHead } from "@/lib/api/fees";
import { formatMoney } from "@/lib/format";
import { isAmount } from "@/lib/money";
import { P } from "@/lib/permissions";
import { useCan, useClasses } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Fee heads (FR 10.1), class amounts per year (FR 10.2) and sibling discounts (FR 10.4). */
export function FeeSetupPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fee set-up"
        description="Choose the fees your school charges, then the amount for each class in the selected year."
      />
      <Tabs defaultValue="amounts">
        <TabsList>
          <TabsTrigger value="amounts">Class amounts</TabsTrigger>
          <TabsTrigger value="heads">Fee heads</TabsTrigger>
          <TabsTrigger value="siblings">Sibling discounts</TabsTrigger>
        </TabsList>
        <TabsContent value="amounts" className="mt-4">
          <ClassAmounts />
        </TabsContent>
        <TabsContent value="heads" className="mt-4">
          <Heads />
        </TabsContent>
        <TabsContent value="siblings" className="mt-4">
          <SiblingRules />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useHeads() {
  return useQuery({ queryKey: ["fees", "heads"], queryFn: fees.heads });
}

function Heads() {
  const can = useCan();
  const queryClient = useQueryClient();
  const heads = useHeads();
  const [editing, setEditing] = useState<FeeHead | "new" | null>(null);
  const toggle = useMutation({
    mutationFn: (h: FeeHead) => fees.headStatus(h.id ?? 0, h.status !== "ACTIVE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees"] }),
    onError,
  });
  if (heads.isPending) return <Loading />;
  if (heads.isError) return <ErrorState error={heads.error} onRetry={() => heads.refetch()} />;
  const manage = can(P.FEES_SETUP);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Fee heads</CardTitle>
          <CardDescription>No head is compulsory. Switch off heads you no longer charge; their history stays.</CardDescription>
        </div>
        {manage && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add fee head
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Charged</TableHead>
              <TableHead className="text-right">Maximum</TableHead>
              <TableHead>Refundable</TableHead>
              <TableHead>In use</TableHead>
              {manage && <TableHead className="w-20"><span className="sr-only">Edit</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {heads.data.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">
                  {h.name} {h.systemCode && <Badge variant="outline">Built in</Badge>}
                </TableCell>
                <TableCell>{FREQUENCIES.find((f) => f.value === h.frequency)?.label}</TableCell>
                <TableCell className="text-right">{h.maxAmount ? formatMoney(h.maxAmount) : "—"}</TableCell>
                <TableCell>{h.refundable ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Switch
                    aria-label={`${h.name} in use`}
                    checked={h.status === "ACTIVE"}
                    disabled={!manage || toggle.isPending}
                    onCheckedChange={() => toggle.mutate(h)}
                  />
                </TableCell>
                {manage && (
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(h)}>
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {editing && <HeadDialog head={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function HeadDialog({ head, onClose }: { head: FeeHead | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(head?.name ?? "");
  const [frequency, setFrequency] = useState(head?.frequency ?? "MONTHLY");
  const [maxAmount, setMaxAmount] = useState(head?.maxAmount ?? "");
  const [refundable, setRefundable] = useState(head?.refundable ?? false);
  const save = useMutation({
    mutationFn: () => {
      const body = { name, frequency, maxAmount: maxAmount || undefined, refundable, version: head?.version };
      return head ? fees.updateHead(head.id ?? 0, body) : fees.createHead(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success("Fee head saved");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{head ? `Edit ${head.name}` : "Add fee head"}</DialogTitle>
          </DialogHeader>
          <Field id="head-name" label="Name" hint="e.g. Tuition fee, Transport, Annual charges">
            <Input id="head-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="head-frequency" label="How often it is charged">
            <NativeSelect id="head-frequency" value={frequency} disabled={!!head?.systemCode} onChange={(e) => setFrequency(e.target.value)}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="head-max" label="Maximum amount (optional)" hint="Amounts above this are refused">
            <Input id="head-max" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={refundable} onCheckedChange={(c) => setRefundable(c === true)} /> Refundable (e.g. security deposit)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || (maxAmount !== "" && !isAmount(maxAmount))}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Grid of classes × fee heads for the selected year; empty cells are flagged as missing. */
function ClassAmounts() {
  const can = useCan();
  const queryClient = useQueryClient();
  const { selected } = useYear();
  const yearId = selected?.id ?? 0;
  const heads = useHeads();
  const classes = useClasses();
  const amounts = useQuery({
    queryKey: ["fees", "class-amounts", yearId],
    queryFn: () => fees.classAmounts(yearId),
    enabled: yearId > 0,
  });
  const missing = useQuery({
    queryKey: ["fees", "missing", yearId],
    queryFn: () => fees.missingAmounts(yearId),
    enabled: yearId > 0,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (classId: number, headId: number) => `${classId}:${headId}`;
  const stored = new Map((amounts.data ?? []).map((a) => [key(a.classId ?? 0, a.feeHeadId ?? 0), a.amount ?? ""]));
  const save = useMutation({
    mutationFn: () =>
      fees.saveClassAmounts(
        yearId,
        Object.entries(draft).map(([k, amount]) => {
          const [classId, feeHeadId] = k.split(":").map(Number);
          return { classId, feeHeadId, amount: amount.trim() || undefined };
        }),
      ),
    onSuccess: () => {
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success("Amounts saved");
    },
    onError,
  });
  if (!selected) return <Empty title="Create an academic year first" />;
  if (heads.isPending || classes.isPending || amounts.isPending) return <Loading />;
  if (amounts.isError) return <ErrorState error={amounts.error} onRetry={() => amounts.refetch()} />;
  const activeHeads = (heads.data ?? []).filter((h) => h.status === "ACTIVE" && !h.systemCode);
  const activeClasses = (classes.data ?? []).filter((c) => c.status === "ACTIVE");
  const manage = can(P.FEES_SETUP) && selected.status !== "CLOSED";
  const invalid = Object.values(draft).some((v) => v.trim() !== "" && !isAmount(v, { allowZero: true }));
  if (activeHeads.length === 0) return <Empty title="Add fee heads first">Use the Fee heads tab.</Empty>;
  return (
    <div className="flex flex-col gap-4">
      {(missing.data ?? []).length > 0 && (
        <Alert>
          <AlertTitle>{missing.data?.length} amounts are not set for {selected.name}</AlertTitle>
          <AlertDescription>
            Empty cells are flagged below. Students in those classes are not charged that fee until an amount is set (enter 0
            for free).
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="border-b p-2 text-left font-medium">
                  Class
                </th>
                {activeHeads.map((h) => (
                  <th key={h.id} scope="col" className="border-b p-2 text-left font-medium">
                    {h.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {FREQUENCIES.find((f) => f.value === h.frequency)?.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeClasses.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="border-b p-2 text-left font-medium">
                    {c.name}
                  </th>
                  {activeHeads.map((h) => {
                    const k = key(c.id ?? 0, h.id ?? 0);
                    const value = draft[k] ?? stored.get(k) ?? "";
                    const isMissing = value.trim() === "";
                    return (
                      <td key={k} className="border-b p-1.5">
                        <Input
                          aria-label={`${h.name} for ${c.name}`}
                          inputMode="decimal"
                          disabled={!manage}
                          className={isMissing ? "w-28 border-amber-500" : "w-28"}
                          placeholder="Not set"
                          value={value}
                          aria-invalid={value.trim() !== "" && !isAmount(value, { allowZero: true })}
                          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {manage && (
        <div>
          <Button disabled={Object.keys(draft).length === 0 || invalid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : `Save ${Object.keys(draft).length} changes`}
          </Button>
        </div>
      )}
    </div>
  );
}

type RuleDraft = { childOrder: number; percent: string; feeHeadIds: number[] };

function SiblingRules() {
  const can = useCan();
  const queryClient = useQueryClient();
  const heads = useHeads();
  const rules = useQuery({ queryKey: ["fees", "sibling-rules"], queryFn: fees.siblingRules });
  const [draft, setDraft] = useState<RuleDraft[] | null>(null);
  const list: RuleDraft[] =
    draft ?? (rules.data ?? []).map((r) => ({ childOrder: r.childOrder ?? 2, percent: r.percent ?? "", feeHeadIds: r.feeHeadIds ?? [] }));
  const save = useMutation({
    mutationFn: () => fees.saveSiblingRules(list),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["fees", "sibling-rules"] });
      toast.success("Sibling discounts saved");
    },
    onError,
  });
  if (rules.isPending || heads.isPending) return <Loading />;
  const manage = can(P.FEES_SETUP);
  const update = (i: number, patch: Partial<RuleDraft>) =>
    setDraft(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const feeHeads = (heads.data ?? []).filter((h) => !h.systemCode && h.status === "ACTIVE");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sibling discounts</CardTitle>
        <CardDescription>
          Applied automatically on new bills by the child&apos;s position in the family (oldest admission first). The rule for
          the highest position reached applies, e.g. a 4th child gets the 3rd-child rule if there is no 4th-child rule.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No sibling discounts.</p>}
        {list.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field id={`sib-order-${i}`} label="Child">
                <NativeSelect id={`sib-order-${i}`} className="w-32" disabled={!manage} value={r.childOrder} onChange={(e) => update(i, { childOrder: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`} child
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id={`sib-pct-${i}`} label="Discount (%)">
                <Input id={`sib-pct-${i}`} className="w-24" inputMode="decimal" disabled={!manage} value={r.percent} onChange={(e) => update(i, { percent: e.target.value })} />
              </Field>
              {manage && (
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove rule" onClick={() => setDraft(list.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </div>
            <fieldset className="flex flex-wrap gap-3 text-sm">
              <legend className="mb-1 text-xs text-muted-foreground">On these fees (none ticked = all fees)</legend>
              {feeHeads.map((h) => (
                <label key={h.id} className="flex items-center gap-1.5">
                  <Checkbox
                    disabled={!manage}
                    checked={r.feeHeadIds.includes(h.id ?? 0)}
                    onCheckedChange={(c) =>
                      update(i, { feeHeadIds: c ? [...r.feeHeadIds, h.id ?? 0] : r.feeHeadIds.filter((x) => x !== h.id) })
                    }
                  />
                  {h.name}
                </label>
              ))}
            </fieldset>
          </div>
        ))}
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft([...list, { childOrder: Math.min(6, (list.at(-1)?.childOrder ?? 1) + 1), percent: "", feeHeadIds: [] }])}>
              <Plus aria-hidden /> Add rule
            </Button>
            <Button disabled={draft == null || save.isPending || list.some((r) => !isAmount(r.percent))} onClick={() => save.mutate()}>
              Save sibling discounts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
