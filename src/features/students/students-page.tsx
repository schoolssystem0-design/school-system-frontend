"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { IdCard, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, openBlob } from "@/lib/api/client";
import { students } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { ClassSelect, label, Pager, SectionSelect, today, useCan } from "@/features/people/shared";

/** Student list with search and filters (FR 5.3), class strength (FR 5.9) and the admission/withdrawal register. */
export function StudentsPage() {
  const can = useCan();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Students"
        description="Search by name, GR number, father's name or phone."
        actions={
          <>
            {can(P.STUDENTS_MOVE) && (
              <Button variant="outline" render={<Link href="/app/students/promotion" />}>
                Promotion
              </Button>
            )}
            {can(P.STUDENTS_MANAGE) && (
              <Button variant="outline" render={<Link href="/app/students/bulk" />}>
                Bulk edit
              </Button>
            )}
            {can(P.ADMISSIONS_ENROL) && (
              <Button render={<Link href="/app/students/new" />}>
                <Plus aria-hidden /> New admission
              </Button>
            )}
          </>
        }
      />
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Students</TabsTrigger>
          <TabsTrigger value="strength">Class strength</TabsTrigger>
          <TabsTrigger value="register">Admission &amp; leaving register</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <StudentList />
        </TabsContent>
        <TabsContent value="strength" className="mt-4">
          <Strength />
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <Register />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudentList() {
  const can = useCan();
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(0);
  const params = { q, classId: classId || undefined, sectionId: sectionId || undefined, status, page };
  const list = useQuery({ queryKey: ["students", "list", params], queryFn: () => students.list(params) });
  const cards = useMutation({
    mutationFn: () => students.idCards({ sectionId: sectionId || undefined }),
    onSuccess: (blob) => openBlob(blob, "id-cards.pdf"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reset = () => setPage(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="st-search" label="Search">
          <Input
            id="st-search"
            className="w-64"
            value={q}
            placeholder="Name, GR no., father, phone"
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
          />
        </Field>
        <Field id="st-class" label="Class">
          <ClassSelect
            id="st-class"
            className="w-40"
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId("");
              reset();
            }}
          />
        </Field>
        <Field id="st-section" label="Section">
          <SectionSelect
            id="st-section"
            className="w-44"
            value={sectionId}
            classId={classId}
            emptyLabel="All sections"
            onChange={(v) => {
              setSectionId(v);
              reset();
            }}
          />
        </Field>
        <Field id="st-status" label="Status">
          <NativeSelect
            id="st-status"
            className="w-36"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
          >
            <option value="ACTIVE">Studying</option>
            <option value="LEFT">Left school</option>
            <option value="ALL">All</option>
          </NativeSelect>
        </Field>
        {can(P.STUDENTS_PRINT) && sectionId !== "" && (
          <Button variant="outline" disabled={cards.isPending} onClick={() => cards.mutate()}>
            <IdCard aria-hidden /> {cards.isPending ? "Preparing…" : "ID cards for section"}
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No students found" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Roll no.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.grNo}</TableCell>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/students/${s.id}`}>
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.fatherName ?? "—"}</TableCell>
                    <TableCell>{s.className ? `${s.className} - ${s.sectionName}` : "—"}</TableCell>
                    <TableCell>{s.rollNo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                        {s.status === "ACTIVE" ? "Studying" : label(s.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {list.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{list.data.totalItems} students</span>
          <Pager page={page} totalPages={list.data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function Strength() {
  const strength = useQuery({ queryKey: ["students", "strength"], queryFn: students.strength });
  if (strength.isPending) return <Loading />;
  if (strength.isError) return <ErrorState error={strength.error} onRetry={() => strength.refetch()} />;
  if (strength.data.length === 0) return <Empty title="No students in this year yet" />;
  const total = strength.data.reduce<{ boys: number; girls: number; total: number }>(
    (sum, r) => ({ boys: sum.boys + (r.boys ?? 0), girls: sum.girls + (r.girls ?? 0), total: sum.total + (r.total ?? 0) }),
    { boys: 0, girls: 0, total: 0 },
  );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Boys</TableHead>
              <TableHead className="text-right">Girls</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {strength.data.map((r) => (
              <TableRow key={r.sectionId}>
                <TableCell>{r.className}</TableCell>
                <TableCell>{r.sectionName}</TableCell>
                <TableCell className="text-right">{r.boys}</TableCell>
                <TableCell className="text-right">{r.girls}</TableCell>
                <TableCell className="text-right font-medium">{r.total}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                School total
              </TableCell>
              <TableCell className="text-right font-semibold">{total.boys}</TableCell>
              <TableCell className="text-right font-semibold">{total.girls}</TableCell>
              <TableCell className="text-right font-semibold">{total.total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Register() {
  const [from, setFrom] = useState(() => `${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const rows = useQuery({ queryKey: ["students", "register", from, to], queryFn: () => students.register(from, to) });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="reg-from" label="From">
          <Input id="reg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="reg-to" label="To">
          <Input id="reg-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.isPending ? (
            <Loading />
          ) : rows.isError ? (
            <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
          ) : rows.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No admissions or withdrawals in these dates" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>GR no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.data.map((r, i) => (
                  <TableRow key={`${r.studentId}-${r.event}-${i}`}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={r.event === "ADMITTED" ? "default" : "secondary"}>{label(r.event)}</Badge>
                    </TableCell>
                    <TableCell>{r.grNo}</TableCell>
                    <TableCell>
                      <Link className="underline-offset-4 hover:underline" href={`/app/students/${r.studentId}`}>
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.className ? `${r.className} - ${r.sectionName}` : "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">{r.reason ?? "—"}</TableCell>
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
