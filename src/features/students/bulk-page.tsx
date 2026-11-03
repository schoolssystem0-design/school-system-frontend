"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { families, students } from "@/lib/api/people";
import { P } from "@/lib/permissions";
import { SectionSelect, useCan } from "@/features/people/shared";

const STUDENT_FIELDS = [
  ["ROLL_NO", "Roll no."],
  ["SEAT_NO", "Board seat no."],
  ["STUDY_GROUP", "Study group"],
  ["DOB", "Date of birth"],
  ["B_FORM_NO", "B-Form no."],
  ["RELIGION", "Religion"],
  ["NATIONALITY", "Nationality"],
] as const;

const FAMILY_FIELDS = [
  ["FATHER_PHONE", "Father's mobile"],
  ["MOTHER_PHONE", "Mother's mobile"],
  ["FATHER_CNIC", "Father's CNIC"],
  ["MOTHER_CNIC", "Mother's CNIC"],
  ["FATHER_NAME", "Father's name"],
  ["ADDRESS", "Address"],
] as const;

/** Fix one field for many records at once (FR 8.5). Only filled-in rows are changed. */
export function BulkPage() {
  const can = useCan();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bulk edit"
        description="Change one field for a whole section at once. Rows left empty are not changed. Every change is recorded."
        actions={
          <Button variant="outline" render={<Link href="/app/students" />}>
            Students
          </Button>
        }
      />
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Student fields</TabsTrigger>
          {can(P.FAMILIES_MANAGE) && <TabsTrigger value="families">Family fields</TabsTrigger>}
        </TabsList>
        <TabsContent value="students" className="mt-4">
          <BulkEditor kind="students" />
        </TabsContent>
        {can(P.FAMILIES_MANAGE) && (
          <TabsContent value="families" className="mt-4">
            <BulkEditor kind="families" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BulkEditor({ kind }: { kind: "students" | "families" }) {
  const queryClient = useQueryClient();
  const fields = kind === "students" ? STUDENT_FIELDS : FAMILY_FIELDS;
  const [field, setField] = useState<string>(fields[0][0]);
  const [sectionId, setSectionId] = useState<number | "">("");
  const [values, setValues] = useState<Record<number, string>>({});
  const list = useQuery({
    queryKey: ["students", "bulk", sectionId],
    queryFn: () => students.list({ sectionId: Number(sectionId), size: 200 }),
    enabled: sectionId !== "",
  });
  // One row per student, or per family (siblings in the same section share one row).
  const rows =
    kind === "students"
      ? (list.data?.items ?? []).map((s) => ({ id: s.id ?? 0, label: s.name, sub: s.grNo, current: field === "ROLL_NO" ? s.rollNo : undefined }))
      : [...new Map((list.data?.items ?? []).filter((s) => s.familyId).map((s) => [s.familyId, s])).values()].map((s) => ({
          id: s.familyId ?? 0,
          label: s.fatherName ?? "—",
          sub: s.name,
          current: field === "FATHER_PHONE" ? s.fatherPhone : field === "FATHER_NAME" ? s.fatherName : undefined,
        }));
  const save = useMutation({
    mutationFn: () => {
      const changed = Object.entries(values)
        .filter(([, v]) => v.trim() !== "")
        .map(([id, value]) => ({ id: Number(id), value: value.trim() }));
      return kind === "students"
        ? students.bulk({ field, values: changed.map((c) => ({ studentId: c.id, value: c.value })) })
        : families.bulk({ field, values: changed.map((c) => ({ familyId: c.id, value: c.value })) });
    },
    onSuccess: (r) => {
      setValues({});
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`${r.updated} records updated`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const filled = Object.values(values).filter((v) => v.trim() !== "").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id={`${kind}-field`} label="Field">
          <NativeSelect
            id={`${kind}-field`}
            className="w-52"
            value={field}
            onChange={(e) => {
              setField(e.target.value);
              setValues({});
            }}
          >
            {fields.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${kind}-section`} label="Section">
          <SectionSelect
            id={`${kind}-section`}
            className="w-48"
            value={sectionId}
            onChange={(v) => {
              setSectionId(v);
              setValues({});
            }}
          />
        </Field>
      </div>
      {sectionId === "" ? (
        <Empty title="Choose a section" />
      ) : list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <Empty title="No students in this section" />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{kind === "students" ? "Student" : "Father"}</TableHead>
                    <TableHead>{kind === "students" ? "GR no." : "Child"}</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>New value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell>{r.sub}</TableCell>
                      <TableCell className="text-muted-foreground">{r.current ?? "—"}</TableCell>
                      <TableCell>
                        <Input
                          aria-label={`New value for ${r.label}`}
                          className="w-56"
                          type={field === "DOB" ? "date" : "text"}
                          maxLength={500}
                          value={values[r.id] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div>
            <Button type="submit" disabled={filled === 0 || save.isPending}>
              {save.isPending ? "Saving…" : `Save ${filled} changes`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
