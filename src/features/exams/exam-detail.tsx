"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { exams, type Exam } from "@/lib/api/exams";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useCan, useClasses } from "@/features/people/shared";
import { ExamDialog, StatusBadge } from "./exams-page";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** One exam: its details and the classes taking it (FR 14.1–14.2). */
export function ExamDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const exam = useQuery({ queryKey: ["exams", "exam", id], queryFn: () => exams.get(id) });
  const can = useCan();
  const [editing, setEditing] = useState(false);
  if (exam.isPending) return <Loading />;
  if (exam.isError) return <ErrorState error={exam.error} onRetry={() => exam.refetch()} />;
  const e = exam.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={e.name ?? "Exam"}
        description={`${e.startDate ? `${formatDate(e.startDate)} to ${formatDate(e.endDate)}` : "Dates not set"}${e.visible ? "" : " · Hidden from teachers"}${e.countsInCumulative ? ` · Weight ${e.weight} in the cumulative result` : ""}`}
        actions={can(P.EXAMS_MANAGE) ? <Button variant="outline" onClick={() => setEditing(true)}>Edit exam</Button> : undefined}
      />
      {e.comments && <p className="text-sm">{e.comments}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
          <CardDescription>Open a class to set its papers and datesheet, see marks still missing, and review and publish its results.</CardDescription>
        </CardHeader>
        <CardContent>
          {(e.classes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Papers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(e.classes ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/app/exams/classes/${c.id}`} className="font-medium hover:underline">{c.className}</Link>
                      {c.gradingMode === "GRADES" && <span className="ml-2 text-xs text-muted-foreground">grades only</span>}
                    </TableCell>
                    <TableCell>{c.papers}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>{c.publishedVersion ? `Version ${c.publishedVersion}, ${formatDateTime(c.publishedAt)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {can(P.EXAMS_MANAGE) && <AddClasses exam={e} />}
      {editing && <ExamDialog exam={e} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AddClasses({ exam }: { exam: Exam }) {
  const classes = useClasses();
  const queryClient = useQueryClient();
  const taken = new Set((exam.classes ?? []).map((c) => c.classId));
  const open = (classes.data ?? []).filter((c) => c.status === "ACTIVE" && !taken.has(c.id));
  const [chosen, setChosen] = useState<number[]>([]);
  const add = useMutation({
    mutationFn: () => exams.addClasses(exam.id ?? 0, chosen),
    onSuccess: () => {
      setChosen([]);
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Classes added. Their papers were copied from the class subjects.");
    },
    onError,
  });
  if (open.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add classes</CardTitle>
        <CardDescription>Each class gets a paper for each of its subjects this year, with the usual maximum and passing marks.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-4">
          {open.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chosen.includes(c.id ?? 0)}
                onCheckedChange={(v) => setChosen((ids) => (v === true ? [...ids, c.id ?? 0] : ids.filter((x) => x !== c.id)))}
              />
              {c.name}
            </label>
          ))}
        </div>
        <div>
          <Button disabled={chosen.length === 0 || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Adding…" : `Add ${chosen.length || ""} ${chosen.length === 1 ? "class" : "classes"}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
