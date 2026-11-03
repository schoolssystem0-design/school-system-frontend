"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { exams, RESULT_STATUS, type Exam, type Scale } from "@/lib/api/exams";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ClassSelect, useCan } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";

const onError = (e: unknown) => toast.error(errorMessage(e));

export function StatusBadge({ status }: { status?: string }) {
  const s = RESULT_STATUS[status ?? "DRAFT"] ?? RESULT_STATUS.DRAFT;
  return <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", s.className)}>{s.label}</span>;
}

/** Exams of the selected year (FR 14.1), grade scales (D-14) and cumulative results (FR 14.8). */
export function ExamsPage() {
  const can = useCan();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exams"
        description="Create an exam, add classes, set the papers and datesheet, then enter marks and publish results."
        actions={can(P.EXAMS_MANAGE) ? <Button onClick={() => setAdding(true)}>New exam</Button> : undefined}
      />
      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="scales">Grade scales</TabsTrigger>
          {can(P.EXAMS_MANAGE) && <TabsTrigger value="cumulative">Cumulative results</TabsTrigger>}
        </TabsList>
        <TabsContent value="exams" className="mt-4">
          <ExamList />
        </TabsContent>
        <TabsContent value="scales" className="mt-4">
          <Scales />
        </TabsContent>
        <TabsContent value="cumulative" className="mt-4">
          <Cumulative />
        </TabsContent>
      </Tabs>
      {adding && <ExamDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function ExamList() {
  const list = useQuery({ queryKey: ["exams", "list"], queryFn: exams.list });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (list.data.length === 0) return <Empty title="No exams this year yet" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.data.map((e) => (
        <Card key={e.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>
                <Link href={`/app/exams/${e.id}`} className="hover:underline">{e.name}</Link>
              </CardTitle>
              <CardDescription>
                {e.startDate ? `${formatDate(e.startDate)} to ${formatDate(e.endDate)}` : "Dates not set"}
                {!e.visible && " · Hidden from teachers"}
                {e.countsInCumulative ? ` · Weight ${e.weight}` : " · Not in the cumulative result"}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href={`/app/exams/${e.id}`} />}>Open</Button>
          </CardHeader>
          <CardContent>
            {(e.classes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes added yet.</p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {(e.classes ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/app/exams/classes/${c.id}`} className="font-medium hover:underline">{c.className}</Link>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {c.papers} papers <StatusBadge status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Create or edit an exam. */
export function ExamDialog({ exam, onClose }: { exam?: Exam; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(exam?.name ?? "");
  const [startDate, setStartDate] = useState(exam?.startDate ?? "");
  const [endDate, setEndDate] = useState(exam?.endDate ?? "");
  const [comments, setComments] = useState(exam?.comments ?? "");
  const [cumulative, setCumulative] = useState(exam?.countsInCumulative ?? true);
  const [weight, setWeight] = useState(exam?.weight ?? "1");
  const [visible, setVisible] = useState(exam?.visible ?? false);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        comments: comments || undefined,
        countsInCumulative: cumulative,
        weight,
        visible,
        version: exam?.version,
      };
      return exam ? exams.update(exam.id ?? 0, body) : exams.create(body);
    },
    onSuccess: (e) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success(exam ? "Exam saved" : "Exam created");
      onClose();
      if (!exam) router.push(`/app/exams/${e.id}`);
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>{exam ? "Edit exam" : "New exam"}</DialogTitle>
            <DialogDescription>For the selected academic year.</DialogDescription>
          </DialogHeader>
          <Field id="ex-name" label="Name">
            <Input id="ex-name" required maxLength={100} placeholder="First term" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ex-start" label="First day">
              <Input id="ex-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field id="ex-end" label="Last day">
              <Input id="ex-end" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field id="ex-comments" label="Note on report cards (optional)">
            <Textarea id="ex-comments" rows={2} maxLength={1000} value={comments} onChange={(e) => setComments(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={cumulative} onCheckedChange={(c) => setCumulative(c === true)} /> Counts in the cumulative result
          </label>
          {cumulative && (
            <Field id="ex-weight" label="Weight" hint="E.g. 1 for each term, or 40 for a final worth 40%">
              <Input id="ex-weight" inputMode="decimal" className="w-32" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={visible} onCheckedChange={(c) => setVisible(c === true)} /> Visible to teachers (they can enter marks)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save exam"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Scales() {
  const list = useQuery({ queryKey: ["exams", "scales"], queryFn: exams.scales });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.data.map((s) => <ScaleCard key={`${s.id}-${JSON.stringify(s.bands)}`} scale={s} />)}
    </div>
  );
}

type BandDraft = { grade: string; minPercent: string; remark: string; passing: boolean };

function ScaleCard({ scale }: { scale: Scale }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const marks = scale.kind === "MARKS";
  const [bands, setBands] = useState<BandDraft[]>(
    (scale.bands ?? []).map((b) => ({ grade: b.grade ?? "", minPercent: b.minPercent ?? "", remark: b.remark ?? "", passing: b.passing ?? true })),
  );
  const save = useMutation({
    mutationFn: () =>
      exams.saveBands(scale.id ?? 0, {
        bands: bands.map((b) => ({ grade: b.grade, minPercent: marks ? b.minPercent : undefined, remark: b.remark || undefined, passing: b.passing })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams", "scales"] });
      toast.success("Grade scale saved. Published results keep their grades.");
    },
    onError,
  });
  const editable = can(P.EXAMS_MANAGE);
  const set = (i: number, patch: Partial<BandDraft>) => setBands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{scale.name}</CardTitle>
        <CardDescription>
          {marks
            ? "Highest grade first. A percentage gets the first grade whose lowest % it reaches (95.00 is A++)."
            : "For classes graded without marks. Teachers choose one of these grades."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grade</TableHead>
              {marks && <TableHead>Lowest %</TableHead>}
              <TableHead>Remark</TableHead>
              <TableHead>Pass</TableHead>
              {editable && <TableHead className="sr-only">Remove</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bands.map((b, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input aria-label={`Grade ${i + 1}`} className="w-20" disabled={!editable} value={b.grade} onChange={(e) => set(i, { grade: e.target.value })} />
                </TableCell>
                {marks && (
                  <TableCell>
                    <Input aria-label={`Lowest percent for ${b.grade}`} className="w-24" inputMode="decimal" disabled={!editable} value={b.minPercent} onChange={(e) => set(i, { minPercent: e.target.value })} />
                  </TableCell>
                )}
                <TableCell>
                  <Input aria-label={`Remark for ${b.grade}`} disabled={!editable} value={b.remark} onChange={(e) => set(i, { remark: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Checkbox aria-label={`${b.grade} is a pass`} disabled={!editable} checked={b.passing} onCheckedChange={(c) => set(i, { passing: c === true })} />
                </TableCell>
                {editable && (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setBands((bs) => bs.filter((_, j) => j !== i))}>Remove</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {editable && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBands((bs) => [...bs, { grade: "", minPercent: "0", remark: "", passing: false }])}>
              Add grade
            </Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save scale"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Cumulative() {
  const { selected } = useYear();
  const [classId, setClassId] = useState<number | "">("");
  const rows = useQuery({
    queryKey: ["exams", "cumulative", classId, selected?.id],
    queryFn: () => exams.cumulative(Number(classId), selected?.id ?? 0),
    enabled: classId !== "" && selected != null,
  });
  const examNames = Array.from(new Set((rows.data ?? []).flatMap((r) => Object.keys(r.byExam ?? {}))));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The weighted average of the published exams of the year that count in the cumulative result.
      </p>
      <Field id="cum-class" label="Class" className="max-w-xs">
        <ClassSelect id="cum-class" emptyLabel="Choose a class" value={classId} onChange={setClassId} />
      </Field>
      {classId === "" ? (
        <Empty title="Choose a class" />
      ) : rows.isPending ? (
        <Loading />
      ) : rows.isError ? (
        <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
      ) : rows.data.length === 0 ? (
        <Empty title="No published results for this class yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Section</TableHead>
              {examNames.map((n) => <TableHead key={n} className="text-right">{n} %</TableHead>)}
              <TableHead className="text-right">Cumulative %</TableHead>
              <TableHead>Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">GR {r.grNo}</span></TableCell>
                <TableCell>{r.section}</TableCell>
                {examNames.map((n) => <TableCell key={n} className="text-right tabular-nums">{r.byExam?.[n] ?? "—"}</TableCell>)}
                <TableCell className="text-right font-semibold tabular-nums">{r.percent ?? "—"}</TableCell>
                <TableCell>{r.grade ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
