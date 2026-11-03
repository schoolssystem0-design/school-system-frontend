"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
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
import { errorMessage, openBlob } from "@/lib/api/client";
import { exams, type ClassResults, type ExamClass, type StudentResult } from "@/lib/api/exams";
import { newKey } from "@/lib/api/fees";
import { formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { SectionSelect, useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";
import { StatusBadge } from "./exams-page";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** One class of an exam: papers and datesheet, marks progress, results and their workflow, printing (FR 14.2–14.13). */
export function ExamClassPage() {
  const id = Number(useParams<{ id: string }>().id);
  const ec = useQuery({ queryKey: ["exams", "class", id], queryFn: () => exams.examClass(id) });
  const can = useCan();
  if (ec.isPending) return <Loading />;
  if (ec.isError) return <ErrorState error={ec.error} onRetry={() => ec.refetch()} />;
  const c = ec.data;
  const office = can(P.EXAMS_REVIEW) || can(P.EXAMS_MANAGE);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${c.examName} · ${c.className}`}
        description={c.gradingMode === "GRADES" ? "Graded without marks" : "Marked out of the maximum for each paper"}
        actions={
          <>
            <StatusBadge status={c.status} />
            <Button variant="outline" size="sm" render={<Link href={`/app/exams/${c.examId}`} />}>All classes</Button>
          </>
        }
      />
      <Workflow ec={c} />
      <Tabs defaultValue="results">
        <TabsList className="flex-wrap">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="progress">Marks still missing</TabsTrigger>
          <TabsTrigger value="papers">Papers &amp; datesheet</TabsTrigger>
          {office && <TabsTrigger value="analysis">Analysis</TabsTrigger>}
          {can(P.EXAMS_PRINT) && <TabsTrigger value="print">Print</TabsTrigger>}
          {can(P.EXAMS_RESULTS_SEND) && <TabsTrigger value="send">Send to families</TabsTrigger>}
        </TabsList>
        <TabsContent value="results" className="mt-4">
          <Results ec={c} />
        </TabsContent>
        <TabsContent value="progress" className="mt-4">
          <Progress ec={c} />
        </TabsContent>
        <TabsContent value="papers" className="mt-4">
          <Papers key={JSON.stringify(c.papers)} ec={c} />
        </TabsContent>
        <TabsContent value="analysis" className="mt-4">
          <AnalysisPanel ec={c} />
        </TabsContent>
        <TabsContent value="print" className="mt-4">
          <PrintPanel ec={c} />
        </TabsContent>
        <TabsContent value="send" className="mt-4">
          <SendPanel ec={c} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ workflow

function Workflow({ ec }: { ec: ExamClass }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"publish" | "unlock" | null>(null);
  const done = (message: string) => () => {
    setConfirm(null);
    void queryClient.invalidateQueries({ queryKey: ["exams"] });
    toast.success(message);
  };
  const id = ec.id ?? 0;
  const review = useMutation({ mutationFn: () => exams.review(id), onSuccess: done("Marked as reviewed"), onError });
  const draft = useMutation({ mutationFn: () => exams.backToDraft(id), onSuccess: done("Back to draft"), onError });
  const publish = useMutation({ mutationFn: () => exams.publish(id), onSuccess: done("Results published"), onError });
  const unlock = useMutation({
    mutationFn: (reason: string) => guard(() => exams.unlock(id, reason)),
    onSuccess: done("Unlocked for correction. Publish again when done."),
    onError,
  });
  const status = ec.status;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="text-sm">
          {status === "DRAFT" && <p>Teachers are entering marks. When they are complete, review the results.</p>}
          {status === "REVIEWED" && <p>Reviewed by {ec.reviewedBy} on {formatDateTime(ec.reviewedAt)}. Any change to marks sends it back to draft.</p>}
          {status === "PUBLISHED" && (
            <p>Published (version {ec.publishedVersion}) by {ec.publishedBy} on {formatDateTime(ec.publishedAt)}. Marks are locked.</p>
          )}
          {status === "DRAFT" && ec.unlockReason && (
            <p className="text-amber-700">Unlocked for correction: {ec.unlockReason}. Publishing again adds version {(ec.publishedVersion ?? 0) + 1}.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && can(P.EXAMS_REVIEW) && (
            <Button disabled={review.isPending} onClick={() => review.mutate()}>Mark as reviewed</Button>
          )}
          {status === "REVIEWED" && can(P.EXAMS_REVIEW) && (
            <Button variant="outline" disabled={draft.isPending} onClick={() => draft.mutate()}>Back to draft</Button>
          )}
          {status === "REVIEWED" && can(P.EXAMS_PUBLISH) && <Button onClick={() => setConfirm("publish")}>Publish results</Button>}
          {status === "PUBLISHED" && can(P.EXAMS_UNLOCK) && (
            <Button variant="outline" onClick={() => setConfirm("unlock")}>Unlock for correction</Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Publish these results?"
        description="Every mark must be entered. The results are frozen as printed on report cards; changing them later needs an unlock with a reason."
        confirmLabel="Publish"
        pending={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
      <ConfirmDialog
        open={confirm === "unlock"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Unlock published results?"
        description="Marks can be corrected and each change is logged with this reason. The published version is kept; publishing again adds a new one."
        confirmLabel="Unlock"
        destructive
        requireReason
        pending={unlock.isPending}
        onConfirm={(reason) => unlock.mutate(reason)}
      />
    </Card>
  );
}

// ------------------------------------------------------------------- results

function Results({ ec }: { ec: ExamClass }) {
  const can = useCan();
  const [sectionId, setSectionId] = useState<number | "">("");
  const [version, setVersion] = useState<number | "">("");
  const office = can(P.EXAMS_REVIEW) || can(P.EXAMS_MANAGE);
  const versions = useQuery({
    queryKey: ["exams", "versions", ec.id],
    queryFn: () => exams.versions(ec.id ?? 0),
    enabled: office && (ec.publishedVersion ?? 0) > 1,
  });
  const results = useQuery({
    queryKey: ["exams", "results", ec.id, sectionId, version],
    queryFn: () => exams.results(ec.id ?? 0, { sectionId: sectionId || undefined, version: version || undefined }),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="rs-section" label="Section">
          <SectionSelect id="rs-section" className="w-44" emptyLabel="All sections" classId={ec.classId ?? ""} value={sectionId} onChange={setSectionId} />
        </Field>
        {(versions.data ?? []).length > 1 && (
          <Field id="rs-version" label="Version">
            <NativeSelect id="rs-version" value={version} onChange={(e) => setVersion(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Latest</option>
              {(versions.data ?? []).map((v) => (
                <option key={v.version} value={v.version}>Version {v.version} · {formatDateTime(v.publishedAt)}</option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {results.isPending ? (
        <Loading />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <ResultsTable key={results.dataUpdatedAt} ec={ec} results={results.data} />
      )}
    </div>
  );
}

function ResultsTable({ ec, results }: { ec: ExamClass; results: ClassResults }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const gradeOnly = results.gradingMode === "GRADES";
  const students = results.students ?? [];
  const papers = ec.papers ?? [];
  const editableRemarks = ec.status !== "PUBLISHED" && results.live && (can(P.EXAMS_MARKS_ENTER) || can(P.EXAMS_REVIEW));
  const [editing, setEditing] = useState(false);
  const [remarks, setRemarks] = useState<Record<number, { teacher: string; principal: string }>>(() =>
    Object.fromEntries(students.map((s) => [s.studentId ?? 0, { teacher: s.teacherRemark ?? "", principal: s.principalRemark ?? "" }])),
  );
  const save = useMutation({
    mutationFn: () =>
      exams.saveRemarks(ec.id ?? 0, {
        remarks: students.map((s) => ({
          studentId: s.studentId ?? 0,
          teacherRemark: remarks[s.studentId ?? 0].teacher || undefined,
          principalRemark: can(P.EXAMS_REVIEW) ? remarks[s.studentId ?? 0].principal || undefined : undefined,
        })),
      }),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["exams", "results"] });
      toast.success("Remarks saved");
    },
    onError,
  });
  if (students.length === 0) return <Empty title="No students to show" />;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{results.live ? "Results so far (not published)" : `Published results, version ${results.version}`}</CardTitle>
          <CardDescription>
            {students.length} students · {students.filter((s) => s.passed === true).length} passed ·{" "}
            {students.filter((s) => s.passed === false).length} failed
            {students.some((s) => (s.missing ?? 0) > 0) && ` · ${students.filter((s) => (s.missing ?? 0) > 0).length} incomplete`}
          </CardDescription>
        </div>
        {editableRemarks && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Write remarks</Button>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              {papers.map((p) => (
                <TableHead key={p.id} className="text-right">{p.subjectName}{gradeOnly ? "" : ` (${p.maxMarks})`}</TableHead>
              ))}
              {!gradeOnly && <TableHead className="text-right">Total</TableHead>}
              {!gradeOnly && <TableHead className="text-right">%</TableHead>}
              {!gradeOnly && <TableHead>Grade</TableHead>}
              {students.some((s) => s.position != null) && <TableHead className="text-right">Position</TableHead>}
              <TableHead>Result</TableHead>
              {editing && <TableHead>Remarks</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.studentId}>
                <TableCell>
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">{s.section} · GR {s.grNo}</span>
                </TableCell>
                {papers.map((p) => {
                  const r = (s.papers ?? []).find((x) => x.examSubjectId === p.id);
                  return (
                    <TableCell key={p.id} className={cn("text-right tabular-nums", r?.passed === false && "text-red-700")}>
                      {paperText(r, gradeOnly)}
                    </TableCell>
                  );
                })}
                {!gradeOnly && <TableCell className="text-right tabular-nums">{s.totalObtained ? `${s.totalObtained}/${s.totalMax}` : "—"}</TableCell>}
                {!gradeOnly && <TableCell className="text-right tabular-nums">{s.percent ?? "—"}</TableCell>}
                {!gradeOnly && <TableCell className="font-semibold">{s.grade ?? "—"}</TableCell>}
                {students.some((x) => x.position != null) && <TableCell className="text-right">{s.position ?? "—"}</TableCell>}
                <TableCell>{resultText(s)}</TableCell>
                {editing && (
                  <TableCell className="min-w-72">
                    <div className="flex flex-col gap-1">
                      <Textarea
                        aria-label={`Class teacher's remark for ${s.name}`}
                        rows={1}
                        maxLength={500}
                        placeholder="Class teacher's remark"
                        value={remarks[s.studentId ?? 0].teacher}
                        onChange={(e) => setRemarks((r) => ({ ...r, [s.studentId ?? 0]: { ...r[s.studentId ?? 0], teacher: e.target.value } }))}
                      />
                      {can(P.EXAMS_REVIEW) && (
                        <Textarea
                          aria-label={`Principal's remark for ${s.name}`}
                          rows={1}
                          maxLength={500}
                          placeholder="Principal's remark"
                          value={remarks[s.studentId ?? 0].principal}
                          onChange={(e) => setRemarks((r) => ({ ...r, [s.studentId ?? 0]: { ...r[s.studentId ?? 0], principal: e.target.value } }))}
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {editing && (
          <div className="flex gap-2">
            <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save remarks"}</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function paperText(r: NonNullable<StudentResult["papers"]>[number] | undefined, gradeOnly: boolean) {
  if (!r) return "—";
  if (r.flag === "ABSENT") return "Absent";
  if (r.flag === "EXEMPT") return "Exempt";
  const value = gradeOnly ? r.grade : r.obtained;
  return value ?? "—";
}

function resultText(s: StudentResult) {
  if ((s.missing ?? 0) > 0) return <span className="text-muted-foreground">{s.missing} missing</span>;
  if (s.passed == null) return "—";
  return s.passed ? <span className="text-emerald-700">Pass</span> : <span className="font-medium text-red-700">Fail</span>;
}

// ------------------------------------------------------------------ progress

function Progress({ ec }: { ec: ExamClass }) {
  const missing = useQuery({ queryKey: ["exams", "missing", ec.id], queryFn: () => exams.missing(ec.id ?? 0) });
  if (missing.isPending) return <Loading />;
  if (missing.isError) return <ErrorState error={missing.error} onRetry={() => missing.refetch()} />;
  if (missing.data.length === 0) return <Empty title="Every mark is entered" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Paper</TableHead>
          <TableHead>Section</TableHead>
          <TableHead className="text-right">Missing</TableHead>
          <TableHead>Students</TableHead>
          <TableHead className="sr-only">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {missing.data.map((m) => (
          <TableRow key={`${m.examSubjectId}-${m.sectionId}`}>
            <TableCell className="font-medium">{m.subjectName}</TableCell>
            <TableCell>{m.sectionLabel}</TableCell>
            <TableCell className="text-right">{m.missing} of {m.students}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{(m.names ?? []).join(", ")}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/app/exams/marks?examClass=${ec.id}&section=${m.sectionId}&paper=${m.examSubjectId}`} />}
              >
                Enter marks
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// -------------------------------------------------------------------- papers

type PaperDraft = { subjectId: number; subjectName: string; maxMarks: string; passingMarks: string; paperDate: string; startTime: string; endTime: string; syllabus: string };

function Papers({ ec }: { ec: ExamClass }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [papers, setPapers] = useState<PaperDraft[]>(
    (ec.papers ?? []).map((p) => ({
      subjectId: p.subjectId ?? 0,
      subjectName: p.subjectName ?? "",
      maxMarks: p.maxMarks ?? "",
      passingMarks: p.passingMarks ?? "",
      paperDate: p.paperDate ?? "",
      startTime: (p.startTime ?? "").slice(0, 5),
      endTime: (p.endTime ?? "").slice(0, 5),
      syllabus: p.syllabus ?? "",
    })),
  );
  const save = useMutation({
    mutationFn: () =>
      exams.savePapers(ec.id ?? 0, {
        papers: papers.map((p) => ({
          subjectId: p.subjectId,
          maxMarks: p.maxMarks,
          passingMarks: p.passingMarks || undefined,
          paperDate: p.paperDate || undefined,
          startTime: p.startTime || undefined,
          endTime: p.endTime || undefined,
          syllabus: p.syllabus || undefined,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Papers and datesheet saved");
    },
    onError,
  });
  const download = useMutation({
    mutationFn: (kind: "pdf" | "png") => (kind === "pdf" ? exams.datesheet(ec.id ?? 0) : exams.datesheetImage(ec.id ?? 0)),
    onSuccess: (blob, kind) => openBlob(blob, `datesheet-${ec.className}.${kind}`),
    onError,
  });
  const editable = can(P.EXAMS_MANAGE) && ec.status === "DRAFT";
  const set = (i: number, patch: Partial<PaperDraft>) => setPapers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Papers and datesheet</CardTitle>
          <CardDescription>
            {editable ? "Set the maximum and passing marks, the day and time of each paper and its syllabus." : "Papers can be changed while the results are a draft."}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={download.isPending} onClick={() => download.mutate("pdf")}>Datesheet PDF</Button>
          <Button variant="outline" size="sm" disabled={download.isPending} onClick={() => download.mutate("png")}>Datesheet image</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 overflow-x-auto">
        {papers.length === 0 ? (
          <Empty title="No papers. Add subjects to this class under Subjects & marks, then add the class to the exam again." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Maximum</TableHead>
                <TableHead>Passing</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Syllabus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((p, i) => (
                <TableRow key={p.subjectId}>
                  <TableCell className="font-medium">{p.subjectName}</TableCell>
                  <TableCell><Input aria-label={`Maximum marks for ${p.subjectName}`} className="w-20" inputMode="decimal" disabled={!editable} value={p.maxMarks} onChange={(e) => set(i, { maxMarks: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label={`Passing marks for ${p.subjectName}`} className="w-20" inputMode="decimal" disabled={!editable} value={p.passingMarks} onChange={(e) => set(i, { passingMarks: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label={`Date of ${p.subjectName}`} type="date" disabled={!editable} value={p.paperDate} onChange={(e) => set(i, { paperDate: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label={`Start time of ${p.subjectName}`} type="time" disabled={!editable} value={p.startTime} onChange={(e) => set(i, { startTime: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label={`End time of ${p.subjectName}`} type="time" disabled={!editable} value={p.endTime} onChange={(e) => set(i, { endTime: e.target.value })} /></TableCell>
                  <TableCell><Input aria-label={`Syllabus of ${p.subjectName}`} className="min-w-48" disabled={!editable} value={p.syllabus} onChange={(e) => set(i, { syllabus: e.target.value })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {editable && papers.length > 0 && (
          <div>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save papers"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ analysis

function AnalysisPanel({ ec }: { ec: ExamClass }) {
  const analysis = useQuery({ queryKey: ["exams", "analysis", ec.id], queryFn: () => exams.analysis(ec.id ?? 0) });
  const failed = useQuery({ queryKey: ["exams", "failed", ec.id], queryFn: () => exams.failed(ec.id ?? 0) });
  if (analysis.isPending) return <Loading />;
  if (analysis.isError) return <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} />;
  const a = analysis.data;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
          <CardDescription>{a.passed} of {a.students} students passed overall.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Average %</TableHead>
                <TableHead className="text-right">Highest %</TableHead>
                <TableHead className="text-right">Lowest %</TableHead>
                <TableHead className="text-right">Passed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(a.subjects ?? []).map((s) => (
                <TableRow key={s.subject}>
                  <TableCell className="font-medium">{s.subject}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.average ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.highest ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.lowest ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.passed} of {s.students}{s.passPercent ? ` (${s.passPercent}%)` : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Grades</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(a.grades ?? {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">No overall grades.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {Object.entries(a.grades ?? {}).map(([g, n]) => (
                <li key={g} className="flex justify-between"><span className="font-medium">{g}</span><span className="tabular-nums">{n}</span></li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Students who failed</CardTitle>
        </CardHeader>
        <CardContent>
          {failed.isPending ? (
            <Loading />
          ) : (failed.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one failed.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Failed in</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(failed.data ?? []).map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.section}</TableCell>
                    <TableCell>{(s.papers ?? []).filter((p) => p.passed === false).map((p) => p.subject).join(", ") || "Overall grade"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.percent ?? "—"}</TableCell>
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

// --------------------------------------------------------------------- print

function PrintPanel({ ec }: { ec: ExamClass }) {
  const [sectionId, setSectionId] = useState<number | "">("");
  const [withhold, setWithhold] = useState(false);
  const id = ec.id ?? 0;
  const section = sectionId || undefined;
  const print = useMutation({
    mutationFn: ({ kind }: { kind: "admit" | "sheet" | "cards"; name: string }) =>
      kind === "admit"
        ? exams.admitCards(id, { sectionId: section, withholdDefaulters: withhold })
        : kind === "sheet"
          ? exams.resultSheet(id, section)
          : exams.reportCards(id, { sectionId: section }),
    onSuccess: (blob, { name }) => openBlob(blob, name),
    onError,
  });
  return (
    <div className="flex flex-col gap-4">
      <Field id="pr-section" label="Section" className="max-w-xs">
        <SectionSelect id="pr-section" emptyLabel="Whole class" classId={ec.classId ?? ""} value={sectionId} onChange={setSectionId} />
      </Field>
      {ec.status !== "PUBLISHED" && (
        <Alert>
          <AlertTitle>Not published</AlertTitle>
          <AlertDescription>Result sheets and report cards printed now are marked as drafts, for checking only.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Admit cards</CardTitle>
            <CardDescription>Roll number slips with the datesheet, four to a page.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withhold} onCheckedChange={(c) => setWithhold(c === true)} /> Hold back cards of students with overdue fees
            </label>
            <Button variant="outline" disabled={print.isPending} onClick={() => print.mutate({ kind: "admit", name: "admit-cards.pdf" })}>Print admit cards</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result sheet</CardTitle>
            <CardDescription>Every student and paper on one sheet, with totals, grades and positions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled={print.isPending} onClick={() => print.mutate({ kind: "sheet", name: "result-sheet.pdf" })}>Print result sheet</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Report cards</CardTitle>
            <CardDescription>One page per student, in the layout chosen under Rules &amp; settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={print.isPending} onClick={() => print.mutate({ kind: "cards", name: "report-cards.pdf" })}>Print report cards</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- send

function SendPanel({ ec }: { ec: ExamClass }) {
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState<number | "">("");
  // One key per distinct request, so a retry of the same send never messages a family twice
  const key = useMemo(() => newKey(), [sectionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const messages = useQuery({ queryKey: ["exams", "messages"], queryFn: exams.messages });
  const send = useMutation({
    mutationFn: () => exams.sendResults(ec.id ?? 0, { sectionId: sectionId || undefined }, key),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["exams", "messages"] });
      toast.success(`${r.queued} messages queued${r.alreadyQueued ? `, ${r.alreadyQueued} already sent` : ""}${r.noPhone ? `, ${r.noPhone} without a phone` : ""}`);
    },
    onError,
  });
  const published = ec.status === "PUBLISHED";
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Send results by SMS</CardTitle>
          <CardDescription>
            Each family gets the total, percentage, grade and result. It goes to the contact marked to receive results, or else the father or mother.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field id="sd-section" label="Section">
            <SectionSelect id="sd-section" className="w-44" emptyLabel="Whole class" classId={ec.classId ?? ""} value={sectionId} onChange={setSectionId} />
          </Field>
          <Button disabled={!published || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : "Send results"}
          </Button>
          {!published && <p className="text-sm text-muted-foreground">Publish the results first.</p>}
        </CardContent>
      </Card>
      {(messages.data ?? []).length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queued</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(messages.data ?? []).slice(0, 50).map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                <TableCell className="text-sm">{m.body}</TableCell>
                <TableCell>{m.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

