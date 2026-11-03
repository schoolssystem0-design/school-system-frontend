"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { academics, school } from "@/lib/api/endpoints";
import { staff, teaching, type Period } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { SectionSelect, sectionOptions, today, useCan, useClasses } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";

const onError = (e: unknown) => toast.error(errorMessage(e));
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function useTeachers() {
  return useQuery({
    queryKey: ["staff", "teachers"],
    queryFn: () => staff.list({ category: "TEACHER", status: "ACTIVE", size: 200 }),
  });
}

/** Class teachers, subject teachers (FR 3.2) and the weekly timetable, per academic year. */
export function TeachingPage() {
  const { selected } = useYear();
  if (!selected) return <Empty title="Create an academic year first" />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teaching"
        description={`Who teaches which class in ${selected.name}. Changes take effect from a date, so earlier attendance and marks keep the right teacher.`}
      />
      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Teachers by section</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="teacher">Teacher&apos;s timetable</TabsTrigger>
          <TabsTrigger value="handover">Hand over</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments" className="mt-4">
          <Assignments yearId={selected.id ?? 0} />
        </TabsContent>
        <TabsContent value="timetable" className="mt-4">
          <Timetable yearId={selected.id ?? 0} />
        </TabsContent>
        <TabsContent value="teacher" className="mt-4">
          <TeacherTimetable yearId={selected.id ?? 0} />
        </TabsContent>
        <TabsContent value="handover" className="mt-4">
          <Handover yearId={selected.id ?? 0} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Assignments({ yearId }: { yearId: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const classes = useClasses();
  const teachers = useTeachers();
  const [sectionId, setSectionId] = useState<number | "">("");
  const classId = sectionOptions(classes.data).find((s) => s.id === sectionId)?.classId;
  const subjects = useQuery({
    queryKey: ["academics", "class-subjects", yearId, classId],
    queryFn: () => academics.classSubjects(yearId, classId ?? 0),
    enabled: classId != null,
  });
  const key = ["teaching", yearId, "assignments", "section", sectionId];
  const list = useQuery({
    queryKey: key,
    queryFn: () => teaching.assignments(yearId, { sectionId: Number(sectionId) }),
    enabled: sectionId !== "",
  });
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [staffId, setStaffId] = useState<number | "">("");
  const [from, setFrom] = useState(today);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teaching", yearId] });
  const assign = useMutation({
    mutationFn: () =>
      teaching.assign(yearId, {
        sectionId: Number(sectionId),
        subjectId: subjectId === "" ? undefined : subjectId,
        staffId: Number(staffId),
        effectiveFrom: from,
      }),
    onSuccess: () => {
      setStaffId("");
      void refresh();
      toast.success("Teacher assigned");
    },
    onError,
  });
  const end = useMutation({
    mutationFn: (id: number) => teaching.end(yearId, id, today()),
    onSuccess: () => {
      void refresh();
      toast.success("Assignment ended");
    },
    onError,
  });
  const manage = can(P.ACADEMICS_MANAGE);
  const assigned = new Map((list.data ?? []).map((a) => [a.subjectId ?? 0, a]));
  const rows = [
    { subjectId: 0, subjectName: "Class teacher" },
    ...(subjects.data ?? []).map((s) => ({ subjectId: s.subjectId ?? 0, subjectName: s.subjectName ?? "" })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Field id="as-section" label="Section" className="max-w-xs">
        <SectionSelect id="as-section" value={sectionId} onChange={setSectionId} />
      </Field>
      {sectionId === "" ? (
        <Empty title="Choose a section" />
      ) : list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          {subjects.data?.length === 0 && (
            <Alert>
              <AlertDescription>
                No subjects are set for this class in this year. Add them under School setup → Subjects &amp; marks.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Since</TableHead>
                    {manage && <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const a = assigned.get(r.subjectId);
                    return (
                      <TableRow key={r.subjectId}>
                        <TableCell className="font-medium">
                          {r.subjectId === 0 ? <Badge variant="outline">Class teacher</Badge> : r.subjectName}
                        </TableCell>
                        <TableCell>{a?.staffName ?? <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                        <TableCell>{a ? formatDate(a.effectiveFrom) : "—"}</TableCell>
                        {manage && (
                          <TableCell>
                            {a && (
                              <Button size="sm" variant="ghost" disabled={end.isPending} onClick={() => end.mutate(a.id ?? 0)}>
                                End
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {manage && (
            <form
              className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                assign.mutate();
              }}
            >
              <Field id="as-subject" label="Subject">
                <NativeSelect
                  id="as-subject"
                  className="w-48"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Class teacher</option>
                  {(subjects.data ?? []).map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="as-teacher" label="Teacher">
                <NativeSelect
                  id="as-teacher"
                  className="w-56"
                  required
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Choose</option>
                  {(teachers.data?.items ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employeeNo})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="as-from" label="From">
                <Input id="as-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Button type="submit" disabled={assign.isPending || staffId === ""}>
                Assign
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Assigning a new teacher to a subject that already has one replaces them from this date.
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}

type Cell = { subjectId: number | ""; staffId: number | "" };

function Timetable({ yearId }: { yearId: number }) {
  const [sectionId, setSectionId] = useState<number | "">("");
  const week = useQuery({ queryKey: ["school", "week", yearId], queryFn: () => school.week(yearId) });
  const periods = useQuery({
    queryKey: ["teaching", yearId, "timetable", sectionId],
    queryFn: () => teaching.timetable(yearId, { sectionId: Number(sectionId) }),
    enabled: sectionId !== "",
  });
  const days = DAYS.map((d, i) => ({ name: d, weekday: i + 1 })).filter((d) => (week.data?.[d.name] ?? "FULL") !== "OFF");
  return (
    <div className="flex flex-col gap-4">
      <Field id="tt-section" label="Section" className="max-w-xs">
        <SectionSelect id="tt-section" value={sectionId} onChange={setSectionId} />
      </Field>
      {sectionId === "" ? (
        <Empty title="Choose a section" />
      ) : periods.isPending || week.isPending ? (
        <Loading />
      ) : periods.isError ? (
        <ErrorState error={periods.error} onRetry={() => periods.refetch()} />
      ) : (
        <TimetableEditor
          key={`${sectionId}-${periods.dataUpdatedAt}`}
          yearId={yearId}
          sectionId={Number(sectionId)}
          days={days}
          initial={periods.data}
        />
      )}
    </div>
  );
}

/** One teacher's week across all sections (FR 6.4), read-only. */
function TeacherTimetable({ yearId }: { yearId: number }) {
  const teachers = useTeachers();
  const [staffId, setStaffId] = useState<number | "">("");
  const week = useQuery({ queryKey: ["school", "week", yearId], queryFn: () => school.week(yearId) });
  const periods = useQuery({
    queryKey: ["teaching", yearId, "timetable", "staff", staffId],
    queryFn: () => teaching.timetable(yearId, { staffId: Number(staffId) }),
    enabled: staffId !== "",
  });
  const days = DAYS.map((d, i) => ({ name: d, weekday: i + 1 })).filter((d) => (week.data?.[d.name] ?? "FULL") !== "OFF");
  const data = periods.data ?? [];
  const count = Math.max(0, ...data.map((p) => p.periodNo ?? 0));
  const at = (weekday: number, periodNo: number) => data.filter((p) => p.weekday === weekday && p.periodNo === periodNo);
  return (
    <div className="flex flex-col gap-4">
      <Field id="tt-teacher" label="Teacher" className="max-w-xs">
        <NativeSelect id="tt-teacher" value={staffId} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Choose</option>
          {(teachers.data?.items ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {staffId === "" ? (
        <Empty title="Choose a teacher" />
      ) : periods.isPending ? (
        <Loading />
      ) : periods.isError ? (
        <ErrorState error={periods.error} onRetry={() => periods.refetch()} />
      ) : data.length === 0 ? (
        <Empty title="No periods for this teacher yet" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border-b p-2 text-left font-medium">
                    Period
                  </th>
                  {days.map((d) => (
                    <th key={d.weekday} scope="col" className="border-b p-2 text-left font-medium">
                      {d.name.charAt(0) + d.name.slice(1, 3).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
                  <tr key={n} className="align-top">
                    <th scope="row" className="border-b p-2 text-left font-medium">
                      {n}
                    </th>
                    {days.map((d) => (
                      <td key={d.weekday} className="border-b p-2">
                        {at(d.weekday, n).map((p) => (
                          <div key={p.sectionId}>
                            <div className="font-medium">{p.sectionLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.subjectName ?? "—"}
                              {p.startTime ? ` · ${p.startTime.slice(0, 5)}` : ""}
                            </div>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimetableEditor({
  yearId,
  sectionId,
  days,
  initial,
}: {
  yearId: number;
  sectionId: number;
  days: { name: string; weekday: number }[];
  initial: Period[];
}) {
  const can = useCan();
  const queryClient = useQueryClient();
  const classes = useClasses();
  const teachers = useTeachers();
  const classId = sectionOptions(classes.data).find((s) => s.id === sectionId)?.classId;
  const subjects = useQuery({
    queryKey: ["academics", "class-subjects", yearId, classId],
    queryFn: () => academics.classSubjects(yearId, classId ?? 0),
    enabled: classId != null,
  });
  const initialCount = Math.max(6, ...initial.map((p) => p.periodNo ?? 0));
  const [count, setCount] = useState(initialCount);
  const [times, setTimes] = useState<Record<number, { start: string; end: string }>>(() => {
    const t: Record<number, { start: string; end: string }> = {};
    for (const p of initial) {
      t[p.periodNo ?? 0] ??= { start: (p.startTime ?? "").slice(0, 5), end: (p.endTime ?? "").slice(0, 5) };
    }
    return t;
  });
  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(initial.map((p) => [`${p.weekday}:${p.periodNo}`, { subjectId: p.subjectId ?? "", staffId: p.staffId ?? "" }])),
  );
  const manage = can(P.ACADEMICS_MANAGE);
  const save = useMutation({
    mutationFn: () =>
      teaching.saveTimetable(
        yearId,
        sectionId,
        Object.entries(cells)
          .filter(([key, c]) => (c.subjectId !== "" || c.staffId !== "") && Number(key.split(":")[1]) <= count)
          .map(([key, c]) => {
            const [weekday, periodNo] = key.split(":").map(Number);
            const t = times[periodNo];
            return {
              weekday,
              periodNo,
              startTime: t?.start ? `${t.start}:00` : undefined,
              endTime: t?.end ? `${t.end}:00` : undefined,
              subjectId: c.subjectId === "" ? undefined : c.subjectId,
              staffId: c.staffId === "" ? undefined : c.staffId,
            };
          }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teaching", yearId, "timetable"] });
      toast.success("Timetable saved");
    },
    onError,
  });
  const setCell = (key: string, patch: Partial<Cell>) =>
    setCells((c) => ({ ...c, [key]: { ...(c[key] ?? { subjectId: "", staffId: "" }), ...patch } }));
  const numbers = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Weekly timetable</CardTitle>
          <CardDescription>A teacher cannot be in two sections in the same period.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="border-b p-2 text-left font-medium">
                  Period
                </th>
                {days.map((d) => (
                  <th key={d.weekday} scope="col" className="border-b p-2 text-left font-medium">
                    {d.name.charAt(0) + d.name.slice(1, 3).toLowerCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n} className="align-top">
                  <th scope="row" className="border-b p-2 text-left font-normal">
                    <div className="font-medium">{n}</div>
                    <div className="mt-1 flex flex-col gap-1">
                      <Input
                        aria-label={`Period ${n} start`}
                        type="time"
                        className="h-7 w-28"
                        disabled={!manage}
                        value={times[n]?.start ?? ""}
                        onChange={(e) => setTimes((t) => ({ ...t, [n]: { start: e.target.value, end: t[n]?.end ?? "" } }))}
                      />
                      <Input
                        aria-label={`Period ${n} end`}
                        type="time"
                        className="h-7 w-28"
                        disabled={!manage}
                        value={times[n]?.end ?? ""}
                        onChange={(e) => setTimes((t) => ({ ...t, [n]: { start: t[n]?.start ?? "", end: e.target.value } }))}
                      />
                    </div>
                  </th>
                  {days.map((d) => {
                    const key = `${d.weekday}:${n}`;
                    const cell = cells[key];
                    return (
                      <td key={key} className="border-b p-1.5">
                        <div className="flex flex-col gap-1">
                          <NativeSelect
                            aria-label={`${d.name} period ${n} subject`}
                            className="h-7 text-xs"
                            disabled={!manage}
                            value={cell?.subjectId ?? ""}
                            onChange={(e) => setCell(key, { subjectId: e.target.value ? Number(e.target.value) : "" })}
                          >
                            <option value="">—</option>
                            {(subjects.data ?? []).map((s) => (
                              <option key={s.subjectId} value={s.subjectId}>
                                {s.subjectName}
                              </option>
                            ))}
                          </NativeSelect>
                          <NativeSelect
                            aria-label={`${d.name} period ${n} teacher`}
                            className="h-7 text-xs"
                            disabled={!manage}
                            value={cell?.staffId ?? ""}
                            onChange={(e) => setCell(key, { staffId: e.target.value ? Number(e.target.value) : "" })}
                          >
                            <option value="">—</option>
                            {(teachers.data?.items ?? []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {manage && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={count >= 15} onClick={() => setCount(count + 1)}>
            Add period
          </Button>
          <Button variant="outline" disabled={count <= 1} onClick={() => setCount(count - 1)}>
            Remove last period
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save timetable"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Moves all of one teacher's current classes to another from a date (FR 3.2, e.g. when a teacher leaves). */
function Handover({ yearId }: { yearId: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const all = useQuery({ queryKey: ["staff", "teachers", "all"], queryFn: () => staff.list({ category: "TEACHER", status: "", size: 200 }) });
  const active = useTeachers();
  const [fromStaffId, setFrom] = useState<number | "">("");
  const [toStaffId, setTo] = useState<number | "">("");
  const [effectiveFrom, setDate] = useState(today);
  const run = useMutation({
    mutationFn: () => teaching.handover(yearId, { fromStaffId: Number(fromStaffId), toStaffId: Number(toStaffId), effectiveFrom }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["teaching", yearId] });
      toast.success(`${r.moved} classes handed over`);
    },
    onError,
  });
  if (!can(P.ACADEMICS_MANAGE)) return <Empty title="You can view teaching but not change it" />;
  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <Field id="ho-from" label="From teacher">
            <NativeSelect id="ho-from" className="w-56" required value={fromStaffId} onChange={(e) => setFrom(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose</option>
              {(all.data?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status === "LEFT" ? " (left)" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="ho-to" label="To teacher">
            <NativeSelect id="ho-to" className="w-56" required value={toStaffId} onChange={(e) => setTo(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose</option>
              {(active.data?.items ?? [])
                .filter((t) => t.id !== fromStaffId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field id="ho-date" label="From date">
            <Input id="ho-date" type="date" required value={effectiveFrom} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button type="submit" disabled={run.isPending || fromStaffId === "" || toStaffId === ""}>
            Hand over all classes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
