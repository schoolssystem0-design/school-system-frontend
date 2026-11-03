"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { students } from "@/lib/api/people";
import { ClassSelect } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";

type Decision = "PROMOTE" | "REPEAT" | "LEAVE";
type Row = { decision: Decision; sectionId: number | ""; reason: string };

/**
 * Year-end promotion (FR 5.5): each student of a class is promoted, repeats, or leaves. Last year's class stays in the
 * record; the new year gets a new enrolment from its start date.
 */
export function PromotionPage() {
  const { years } = useYear();
  const sorted = [...years].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const current = years.find((y) => y.status === "CURRENT");
  const [fromYearId, setFromYearId] = useState<number | "">(current?.id ?? "");
  const later = sorted.filter((y) => {
    const from = sorted.find((x) => x.id === fromYearId);
    return from && (y.startDate ?? "") > (from.startDate ?? "");
  });
  const [toYearId, setToYearId] = useState<number | "">("");
  const [classId, setClassId] = useState<number | "">("");
  const ready = fromYearId !== "" && toYearId !== "" && classId !== "";
  const preview = useQuery({
    queryKey: ["students", "promotion", fromYearId, toYearId, classId],
    queryFn: () => students.promotionPreview(Number(fromYearId), Number(toYearId), Number(classId)),
    enabled: ready,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotion to the next year"
        description="Open the new academic year first (School setup → Academic years), then promote one class at a time."
        actions={
          <Button variant="outline" render={<Link href="/app/students" />}>
            Students
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="pr-from" label="From year">
          <NativeSelect
            id="pr-from"
            className="w-40"
            value={fromYearId}
            onChange={(e) => {
              setFromYearId(e.target.value ? Number(e.target.value) : "");
              setToYearId("");
            }}
          >
            <option value="">Choose</option>
            {sorted.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="pr-to" label="To year">
          <NativeSelect
            id="pr-to"
            className="w-40"
            value={toYearId}
            onChange={(e) => setToYearId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Choose</option>
            {later.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="pr-class" label="Class">
          <ClassSelect id="pr-class" className="w-40" emptyLabel="Choose" value={classId} onChange={setClassId} />
        </Field>
      </div>
      {fromYearId !== "" && later.length === 0 && (
        <Alert>
          <AlertDescription>There is no later year yet. Create the next academic year first.</AlertDescription>
        </Alert>
      )}
      {ready &&
        (preview.isPending ? (
          <Loading />
        ) : preview.isError ? (
          <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
        ) : (
          <PromotionTable
            key={`${fromYearId}-${toYearId}-${classId}`}
            preview={preview.data}
            fromYearId={Number(fromYearId)}
            toYearId={Number(toYearId)}
          />
        ))}
    </div>
  );
}

function PromotionTable({
  preview,
  fromYearId,
  toYearId,
}: {
  preview: Schemas["Preview"];
  fromYearId: number;
  toYearId: number;
}) {
  const queryClient = useQueryClient();
  const next = preview.nextSections ?? [];
  const same = preview.sameSections ?? [];
  const pending = (preview.students ?? []).filter((s) => !s.alreadyIn);
  const done = (preview.students ?? []).filter((s) => s.alreadyIn);
  const defaultSection = (list: Schemas["SectionRef"][]) => (list.length === 1 ? (list[0].id ?? "") : "");
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(
      pending.map((s) => [
        s.studentId ?? 0,
        next.length > 0
          ? { decision: "PROMOTE" as Decision, sectionId: defaultSection(next), reason: "" }
          : { decision: "LEAVE" as Decision, sectionId: "", reason: "" },
      ]),
    ),
  );
  const setRow = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const setAll = (decision: Decision) =>
    setRows((r) =>
      Object.fromEntries(
        Object.entries(r).map(([id, row]) => [
          id,
          { ...row, decision, sectionId: defaultSection(decision === "PROMOTE" ? next : decision === "REPEAT" ? same : []) },
        ]),
      ),
    );
  const apply = useMutation({
    mutationFn: () =>
      students.promote({
        fromYearId,
        toYearId,
        items: Object.entries(rows).map(([id, row]) => ({
          studentId: Number(id),
          decision: row.decision,
          toSectionId: row.decision === "LEAVE" ? undefined : Number(row.sectionId),
          reason: row.reason || undefined,
        })),
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${r.promoted} promoted, ${r.repeating} repeating, ${r.left} left`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const missingSection = Object.values(rows).some((r) => r.decision !== "LEAVE" && r.sectionId === "");

  if ((preview.students ?? []).length === 0) return <Empty title={`No active students in ${preview.fromClassName}`} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {preview.fromClassName} → {preview.nextClassName ?? "no higher class (final class)"}
      </p>
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Set all to:</span>
          {next.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAll("PROMOTE")}>
              Promote
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAll("REPEAT")}>
            Repeat
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("LEAVE")}>
            Leave
          </Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GR no.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>New section</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((s) => {
                const id = s.studentId ?? 0;
                const row = rows[id];
                const options = row.decision === "PROMOTE" ? next : row.decision === "REPEAT" ? same : [];
                return (
                  <TableRow key={id}>
                    <TableCell>{s.grNo}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.sectionName}</TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`Decision for ${s.name}`}
                        className="w-32"
                        value={row.decision}
                        onChange={(e) => {
                          const decision = e.target.value as Decision;
                          setRow(id, {
                            decision,
                            sectionId: defaultSection(decision === "PROMOTE" ? next : decision === "REPEAT" ? same : []),
                          });
                        }}
                      >
                        {next.length > 0 && <option value="PROMOTE">Promote</option>}
                        <option value="REPEAT">Repeat class</option>
                        <option value="LEAVE">Leaves school</option>
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      {row.decision !== "LEAVE" && (
                        <NativeSelect
                          aria-label={`New section for ${s.name}`}
                          className="w-40"
                          value={row.sectionId}
                          onChange={(e) => setRow(id, { sectionId: e.target.value ? Number(e.target.value) : "" })}
                        >
                          <option value="">Choose</option>
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.className} - {o.sectionName}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Note for ${s.name}`}
                        className="w-48"
                        maxLength={200}
                        value={row.reason}
                        onChange={(e) => setRow(id, { reason: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {done.map((s) => (
                <TableRow key={s.studentId} className="text-muted-foreground">
                  <TableCell>{s.grNo}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.sectionName}</TableCell>
                  <TableCell colSpan={3}>Already in {s.alreadyIn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {pending.length > 0 && (
        <div>
          <Button disabled={apply.isPending || missingSection} onClick={() => apply.mutate()}>
            {apply.isPending ? "Saving…" : `Apply to ${pending.length} students`}
          </Button>
        </div>
      )}
    </div>
  );
}
