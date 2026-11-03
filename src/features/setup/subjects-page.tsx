"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { academics, type ClassSubject, type Subject } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";
import { useYear } from "@/features/shell/year-context";

/** Subjects and per-class maximum/passing marks for the selected academic year (FR 9.4, 14.2). */
export function SubjectsPage() {
  const me = useMe();
  const manage = can(me.data?.permissions, P.ACADEMICS_MANAGE);
  const subjects = useQuery({ queryKey: ["academics", "subjects"], queryFn: academics.subjects });
  const classes = useQuery({ queryKey: ["academics", "classes"], queryFn: academics.classes });

  if (subjects.isPending || classes.isPending) return <Loading />;
  if (subjects.isError) return <ErrorState error={subjects.error} onRetry={() => subjects.refetch()} />;
  if (classes.isError) return <ErrorState error={classes.error} onRetry={() => classes.refetch()} />;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title="Subjects & marks" description="The school's subjects, and the subjects each class takes this year." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <SubjectList subjects={subjects.data} manage={manage} />
        <ClassSubjects subjects={subjects.data} classes={classes.data} manage={manage} />
      </div>
    </div>
  );
}

function SubjectList({ subjects, manage }: { subjects: Subject[]; manage: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["academics", "subjects"] });
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const create = useMutation({
    mutationFn: () => academics.createSubject(name),
    onSuccess: () => {
      setName("");
      void refresh();
    },
    onError,
  });
  const action = useMutation({
    mutationFn: async ({ id, act }: { id: number; act: "delete" | "ACTIVE" | "INACTIVE" }) => {
      if (act === "delete") await academics.deleteSubject(id);
      else await academics.subjectStatus(id, act);
    },
    onSuccess: refresh,
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All subjects</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {manage && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field id="subject-name" label="New subject" className="flex-1">
              <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" required maxLength={80} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              <Plus aria-hidden /> Add
            </Button>
          </form>
        )}
        {subjects.length === 0 ? (
          <Empty title="No subjects yet" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {s.name} <span className="text-muted-foreground">({s.shortName})</span>
                  {s.status === "INACTIVE" && <Badge variant="secondary" className="ms-2">Inactive</Badge>}
                </span>
                {manage && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost"
                      onClick={() => s.id && action.mutate({ id: s.id, act: s.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" })}>
                      {s.status === "INACTIVE" ? "Activate" : "Deactivate"}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${s.name}`}
                      onClick={() => s.id && action.mutate({ id: s.id, act: "delete" })}>
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type Row = { subjectId: number; maxMarks: string; passingMarks: string };

function ClassSubjects({
  subjects,
  classes,
  manage,
}: {
  subjects: Subject[];
  classes: { id?: number; name?: string }[];
  manage: boolean;
}) {
  const { selected } = useYear();
  const [classId, setClassId] = useState<number | null>(classes[0]?.id ?? null);
  const yearId = selected?.id ?? null;
  const key = ["academics", "classSubjects", yearId, classId];
  const rows = useQuery({
    queryKey: key,
    queryFn: () => academics.classSubjects(yearId!, classId!),
    enabled: yearId != null && classId != null,
  });

  if (!selected) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Empty title="No academic year">Create an academic year first.</Empty>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects per class · {selected.name}</CardTitle>
        <CardDescription>Maximum and passing marks used for marks entry and report cards.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field id="cs-class" label="Class">
          <NativeSelect id="cs-class" className="w-56" value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {classes.length === 0 ? (
          <Empty title="No classes yet" />
        ) : rows.isPending ? (
          <Loading />
        ) : rows.isError ? (
          <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
        ) : (
          <ClassSubjectEditor
            key={`${yearId}-${classId}-${rows.dataUpdatedAt}`}
            initial={rows.data}
            subjects={subjects}
            editable={manage && selected.status !== "CLOSED"}
            yearId={yearId!}
            classId={classId!}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ClassSubjectEditor({
  initial,
  subjects,
  editable,
  yearId,
  classId,
}: {
  initial: ClassSubject[];
  subjects: Subject[];
  editable: boolean;
  yearId: number;
  classId: number;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(
    initial
      .filter((r) => r.status === "ACTIVE")
      .map((r) => ({
        subjectId: r.subjectId ?? 0,
        maxMarks: String(r.maxMarks ?? ""),
        passingMarks: r.passingMarks == null ? "" : String(r.passingMarks),
      })),
  );
  const [adding, setAdding] = useState<number | "">("");
  const save = useMutation({
    mutationFn: () =>
      academics.saveClassSubjects(
        yearId,
        classId,
        rows.map((r) => ({
          subjectId: r.subjectId,
          maxMarks: Number(r.maxMarks),
          passingMarks: r.passingMarks === "" ? undefined : Number(r.passingMarks),
        })),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(["academics", "classSubjects", yearId, classId], saved);
      toast.success("Subjects saved for this class");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const name = (id: number) => subjects.find((s) => s.id === id)?.name ?? "?";
  const available = subjects.filter((s) => s.status === "ACTIVE" && !rows.some((r) => r.subjectId === s.id));

  function move(i: number, d: number) {
    setRows((all) => {
      const copy = [...all];
      const [item] = copy.splice(i, 1);
      copy.splice(i + d, 0, item);
      return copy;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subjects for this class yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead className="w-28">Max marks</TableHead>
              <TableHead className="w-28">Passing</TableHead>
              {editable && <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.subjectId}>
                <TableCell>{name(r.subjectId)}</TableCell>
                <TableCell>
                  <Input aria-label={`Maximum marks for ${name(r.subjectId)}`} inputMode="decimal" value={r.maxMarks} disabled={!editable}
                    onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, maxMarks: e.target.value } : x)))} />
                </TableCell>
                <TableCell>
                  <Input aria-label={`Passing marks for ${name(r.subjectId)}`} inputMode="decimal" value={r.passingMarks} disabled={!editable}
                    onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, passingMarks: e.target.value } : x)))} />
                </TableCell>
                {editable && (
                  <TableCell className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" disabled={i === rows.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${name(r.subjectId)}`}
                      onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <Field id="cs-add" label="Add subject">
            <NativeSelect id="cs-add" className="w-48" value={adding} onChange={(e) => setAdding(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={adding === ""}
            onClick={() => {
              if (adding === "") return;
              setRows((all) => [...all, { subjectId: adding, maxMarks: "100", passingMarks: "33" }]);
              setAdding("");
            }}
          >
            <Plus aria-hidden /> Add
          </Button>
          <Button type="button" className="ms-auto" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save subjects"}
          </Button>
        </div>
      )}
    </div>
  );
}
