"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { exams, type MarkGrid } from "@/lib/api/exams";
import { cn } from "@/lib/utils";
import { SectionSelect } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

type Entry = { value: string; flag: "" | "ABSENT" | "EXEMPT" };

/**
 * Marks entry (FR 14.4–14.6): one paper of one section at a time. Teachers can enter only the subjects they teach;
 * Absent and Exempt are entries, an empty box is a missing mark.
 */
export function MarksPage() {
  const params = useSearchParams();
  const router = useRouter();
  const examClassId = Number(params.get("examClass")) || "";
  const sectionId = Number(params.get("section")) || "";
  const paperId = Number(params.get("paper")) || "";
  const [examId, setExamId] = useState<number | "">("");
  const list = useQuery({ queryKey: ["exams", "list"], queryFn: exams.list });
  const ec = useQuery({
    queryKey: ["exams", "class", examClassId],
    queryFn: () => exams.examClass(Number(examClassId)),
    enabled: examClassId !== "",
  });
  const chosenExam = examId !== "" ? examId : ec.data?.examId ?? "";
  const exam = (list.data ?? []).find((e) => e.id === chosenExam);
  const go = (next: { examClass?: number | ""; section?: number | ""; paper?: number | "" }) => {
    const q = new URLSearchParams();
    const merged = { examClass: examClassId, section: sectionId, paper: paperId, ...next };
    for (const [k, v] of Object.entries(merged)) if (v !== "" && v != null) q.set(k, String(v));
    router.replace(`/app/exams/marks?${q.toString()}`);
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Enter marks" description="Choose the exam, class, section and paper. Save often; you can come back to finish." />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="mk-exam" label="Exam">
          <NativeSelect
            id="mk-exam"
            className="w-48"
            value={chosenExam}
            onChange={(e) => {
              setExamId(e.target.value ? Number(e.target.value) : "");
              go({ examClass: "", section: "", paper: "" });
            }}
          >
            <option value="">Choose an exam</option>
            {(list.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </NativeSelect>
        </Field>
        <Field id="mk-class" label="Class">
          <NativeSelect
            id="mk-class"
            className="w-40"
            value={examClassId}
            disabled={!exam}
            onChange={(e) => go({ examClass: e.target.value ? Number(e.target.value) : "", section: "", paper: "" })}
          >
            <option value="">Choose a class</option>
            {(exam?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
          </NativeSelect>
        </Field>
        <Field id="mk-section" label="Section">
          <SectionSelect
            id="mk-section"
            className="w-44"
            classId={ec.data?.classId ?? ""}
            value={sectionId}
            onChange={(v) => go({ section: v })}
          />
        </Field>
        <Field id="mk-paper" label="Paper">
          <NativeSelect
            id="mk-paper"
            className="w-44"
            value={paperId}
            disabled={!ec.data}
            onChange={(e) => go({ paper: e.target.value ? Number(e.target.value) : "" })}
          >
            <option value="">Choose a paper</option>
            {(ec.data?.papers ?? []).map((p) => <option key={p.id} value={p.id}>{p.subjectName}</option>)}
          </NativeSelect>
        </Field>
      </div>
      {examClassId === "" || sectionId === "" || paperId === "" ? (
        <Empty title="Choose the exam, class, section and paper" />
      ) : (
        <GridLoader key={`${examClassId}-${sectionId}-${paperId}`} examClassId={examClassId} sectionId={sectionId} paperId={paperId} />
      )}
    </div>
  );
}

function GridLoader({ examClassId, sectionId, paperId }: { examClassId: number; sectionId: number; paperId: number }) {
  const grid = useQuery({
    queryKey: ["exams", "marks", examClassId, sectionId, paperId],
    queryFn: () => exams.marks(examClassId, sectionId, paperId),
    retry: false,
  });
  if (grid.isPending) return <Loading />;
  if (grid.isError) return <ErrorState error={grid.error} />;
  return <Grid key={grid.dataUpdatedAt} grid={grid.data} />;
}

function Grid({ grid }: { grid: MarkGrid }) {
  const queryClient = useQueryClient();
  const gradeOnly = grid.gradingMode === "GRADES";
  const rows = grid.rows ?? [];
  const initial = Object.fromEntries(
    rows.map((r) => [r.studentId ?? 0, { value: (gradeOnly ? r.grade : r.obtained) ?? "", flag: (r.flag ?? "") as Entry["flag"] }]),
  );
  const [entries, setEntries] = useState<Record<number, Entry>>(initial);
  const max = Number(grid.maxMarks);
  const over = rows.filter((r) => {
    const e = entries[r.studentId ?? 0];
    return !gradeOnly && !e.flag && e.value !== "" && (Number.isNaN(Number(e.value)) || Number(e.value) > max || Number(e.value) < 0);
  });
  const missing = rows.filter((r) => !entries[r.studentId ?? 0].flag && entries[r.studentId ?? 0].value === "").length;
  const save = useMutation({
    mutationFn: () =>
      exams.saveMarks(grid.examClassId ?? 0, grid.sectionId ?? 0, grid.examSubjectId ?? 0, {
        marks: rows.map((r) => {
          const e = entries[r.studentId ?? 0];
          return {
            studentId: r.studentId ?? 0,
            flag: e.flag || undefined,
            obtained: !gradeOnly && !e.flag && e.value !== "" ? e.value.trim() : undefined,
            grade: gradeOnly && !e.flag && e.value !== "" ? e.value : undefined,
          };
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Marks saved");
    },
    onError,
  });
  const set = (id: number, patch: Partial<Entry>) => setEntries((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  if (rows.length === 0) return <Empty title="No students in this section" />;
  const editable = grid.canEdit && grid.status !== "PUBLISHED";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{grid.subjectName} · {grid.sectionLabel}</CardTitle>
        <CardDescription>
          {gradeOnly ? `Grades: ${(grid.grades ?? []).join(", ")}` : `Out of ${grid.maxMarks}${grid.passingMarks ? `, passing ${grid.passingMarks}` : ""}`}
          {` · ${missing} not entered yet`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {grid.status === "PUBLISHED" && (
          <Alert>
            <AlertDescription>These results are published, so marks are locked. To correct them, ask someone allowed to unlock the class.</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>{gradeOnly ? "Grade" : "Marks"}</TableHead>
              <TableHead>Not marked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const id = r.studentId ?? 0;
              const e = entries[id];
              const bad = over.includes(r);
              return (
                <TableRow key={id}>
                  <TableCell>{r.rollNo ?? "—"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">GR {r.grNo}</span>
                  </TableCell>
                  <TableCell>
                    {gradeOnly ? (
                      <NativeSelect
                        aria-label={`Grade for ${r.name}`}
                        className="w-24"
                        disabled={!editable || e.flag !== ""}
                        value={e.value}
                        onChange={(ev) => set(id, { value: ev.target.value })}
                      >
                        <option value="">—</option>
                        {(grid.grades ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
                      </NativeSelect>
                    ) : (
                      <Input
                        aria-label={`Marks for ${r.name}`}
                        aria-invalid={bad || undefined}
                        inputMode="decimal"
                        className={cn("w-24 tabular-nums", bad && "border-destructive")}
                        disabled={!editable || e.flag !== ""}
                        value={e.flag ? "" : e.value}
                        onChange={(ev) => set(id, { value: ev.target.value })}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" role="group" aria-label={`Absent or exempt for ${r.name}`}>
                      {(["ABSENT", "EXEMPT"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          aria-pressed={e.flag === f}
                          disabled={!editable}
                          onClick={() => set(id, { flag: e.flag === f ? "" : f })}
                          className={cn(
                            "h-8 rounded-md border px-2 text-xs font-medium disabled:opacity-60",
                            e.flag === f ? (f === "ABSENT" ? "bg-red-600 text-white" : "bg-slate-600 text-white") : "bg-background hover:bg-muted",
                          )}
                        >
                          {f === "ABSENT" ? "Absent" : "Exempt"}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {over.length > 0 && (
          <p className="text-sm text-destructive" role="alert">
            {over.length === 1 ? "One mark is" : `${over.length} marks are`} not a number between 0 and {grid.maxMarks}.
          </p>
        )}
        {editable && (
          <div>
            <Button disabled={save.isPending || over.length > 0} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save marks"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
