"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, openBlob, type Schemas } from "@/lib/api/client";
import { students } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { SectionSelect, today } from "@/features/people/shared";
import { ClassListDownload } from "@/features/reports/record-downloads";

/** Admitting a whole class from an Excel sheet: every row is checked first; all are admitted or none. */
export function StudentImportPage() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sectionId, setSectionId] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<Schemas["ImportCheck"] | null>(null);
  const [result, setResult] = useState<Schemas["ImportResult"] | null>(null);
  const ready = sectionId !== "" && Boolean(date) && file !== null;

  const template = useMutation({
    mutationFn: students.importTemplate,
    onSuccess: (blob) => openBlob(blob, "students-import-template.xlsx"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const checking = useMutation({
    mutationFn: () => students.checkImport(file as File, Number(sectionId), date),
    onSuccess: setCheck,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const importing = useMutation({
    mutationFn: () => students.importStudents(file as File, Number(sectionId), date),
    onSuccess: (r) => {
      setResult(r);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${r.admitted} students admitted`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changed = () => {
    setCheck(null);
    setResult(null);
  };

  if (result) {
    const list = result.students ?? [];
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Students admitted" description={`${result.admitted} students in ${result.section}`} />
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertDescription>
            All {result.admitted} students were admitted with GR numbers {list[0]?.grNo} to {list[list.length - 1]?.grNo}.
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>GR no.</TableHead>
                  <TableHead>Student</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{s.row}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{s.grNo}</TableCell>
                    <TableCell>
                      <Link href={`/app/students/${s.id}`} className="underline-offset-4 hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <ClassListDownload sectionId={sectionId} />
          <Button variant="outline" render={<Link href="/app/students" />}>
            Go to students
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFile(null);
              changed();
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Import another sheet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Import students from Excel"
        description="Admit a whole class at once. Every row is checked first: if anything is missing, nobody is admitted."
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Fill in the template</CardTitle>
          <CardDescription>
            One student per row. Required: student name, gender, date of birth, father&apos;s name and father&apos;s mobile.
            GR numbers are given automatically. Children with the same father&apos;s mobile become one family.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={template.isPending} onClick={() => template.mutate()}>
            <Download aria-hidden /> Download Excel template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Choose the class and upload the sheet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field id="im-section" label="Admit into">
            <SectionSelect
              id="im-section"
              className="w-48"
              value={sectionId}
              onChange={(v) => {
                setSectionId(v);
                changed();
              }}
            />
          </Field>
          <Field id="im-date" label="Admission date">
            <Input
              id="im-date"
              type="date"
              className="w-44"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                changed();
              }}
            />
          </Field>
          <Field id="im-file" label="Filled-in Excel file">
            <Input
              ref={fileInput}
              id="im-file"
              type="file"
              className="w-72"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                changed();
              }}
            />
          </Field>
          <Button disabled={!ready || checking.isPending} onClick={() => checking.mutate()}>
            <FileSpreadsheet aria-hidden /> {checking.isPending ? "Checking…" : "Check the sheet"}
          </Button>
        </CardContent>
      </Card>

      {check && <CheckResult check={check} importing={importing.isPending} onImport={() => importing.mutate()} />}
    </div>
  );
}

function CheckResult({
  check,
  importing,
  onImport,
}: {
  check: Schemas["ImportCheck"];
  importing: boolean;
  onImport: () => void;
}) {
  const rows = check.rows ?? [];
  const fileProblems = check.fileProblems ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Check and admit</CardTitle>
        <CardDescription>
          {check.students} students for {check.section}, admitted on {formatDate(check.admissionDate)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {check.ready ? (
          <Alert>
            <CheckCircle2 aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>All {check.students} students are complete and ready to admit.</span>
              <Button disabled={importing} onClick={onImport}>
                <Upload aria-hidden /> {importing ? "Admitting…" : `Admit ${check.students} students`}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>
              {fileProblems.length > 0
                ? fileProblems.join(" ")
                : `${check.rowsWithProblems} of ${check.students} rows have problems (shown in red below).`}{" "}
              Nothing has been imported. Fix the sheet in Excel and upload it again.
            </AlertDescription>
          </Alert>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const problems = r.problems ?? [];
                  return (
                    <TableRow key={r.row} className={problems.length ? "bg-destructive/5" : undefined}>
                      <TableCell className="tabular-nums text-muted-foreground">{r.row}</TableCell>
                      <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                      <TableCell>{r.gender === "FEMALE" ? "Female" : r.gender === "MALE" ? "Male" : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.dob ? formatDate(r.dob) : "—"}</TableCell>
                      <TableCell>{r.fatherName ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{r.fatherPhone ?? "—"}</TableCell>
                      <TableCell className="min-w-40 whitespace-normal text-sm text-muted-foreground">{r.family ?? "—"}</TableCell>
                      <TableCell className="min-w-64 whitespace-normal">
                        {problems.length === 0 ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">
                            OK
                          </Badge>
                        ) : (
                          <ul className="flex flex-col gap-0.5 text-sm text-destructive">
                            {problems.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
