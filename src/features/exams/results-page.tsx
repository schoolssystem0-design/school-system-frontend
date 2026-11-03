"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exams } from "@/lib/api/exams";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "./exams-page";

/** Every class of every exam this year with where its results stand (FR 14.7–14.11). */
export function ResultsPage() {
  const list = useQuery({ queryKey: ["exams", "list"], queryFn: exams.list });
  const rows = (list.data ?? []).flatMap((e) => (e.classes ?? []).map((c) => ({ exam: e, c })));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results" description="Open a class to review, publish and print its results." />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <Empty title="No exam classes this year yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ exam, c }) => (
              <TableRow key={c.id}>
                <TableCell>{exam.name}</TableCell>
                <TableCell>
                  <Link href={`/app/exams/classes/${c.id}`} className="font-medium hover:underline">{c.className}</Link>
                </TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell>{c.publishedVersion ? `Version ${c.publishedVersion}, ${formatDateTime(c.publishedAt)}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** A student's published results across years, for the profile. */
export function StudentResults({ studentId }: { studentId: number }) {
  const rows = useQuery({ queryKey: ["exams", "student", studentId], queryFn: () => exams.studentResults(studentId) });
  if (rows.isPending) return <Loading />;
  if (rows.isError) return <ErrorState error={rows.error} onRetry={() => rows.refetch()} />;
  if (rows.data.length === 0) return <Empty title="No published results yet" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year</TableHead>
          <TableHead>Exam</TableHead>
          <TableHead>Class</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead className="text-right">Position</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.data.map((r) => (
          <TableRow key={r.examClassId}>
            <TableCell>{r.year}</TableCell>
            <TableCell>
              <Link href={`/app/exams/classes/${r.examClassId}`} className="font-medium hover:underline">{r.examName}</Link>
            </TableCell>
            <TableCell>{r.className}</TableCell>
            <TableCell className="text-right tabular-nums">{r.totalObtained ? `${r.totalObtained}/${r.totalMax}` : "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{r.percent ?? "—"}</TableCell>
            <TableCell>{r.grade ?? "—"}</TableCell>
            <TableCell className="text-right">{r.position ?? "—"}</TableCell>
            <TableCell>{r.passed == null ? "—" : r.passed ? "Pass" : "Fail"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
