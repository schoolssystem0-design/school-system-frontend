"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { academics } from "@/lib/api/endpoints";
import { testMarks, type TestSheet } from "@/lib/api/test-marks";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { CloudOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isNetworkError } from "@/lib/offline/queue";
import { saveOrQueue } from "@/lib/offline/save";
import { useSyncState } from "@/features/shell/offline-bar";
import { SectionSelect, today, useCan } from "@/features/people/shared";
import { ExportBar } from "@/features/reports/export-bar";

const onError = (e: unknown) => toast.error(errorMessage(e));

/** Test marks of a section and the overall positions over a period (D-51). */
export function TestMarksPage() {
  const can = useCan();
  const [sectionId, setSectionId] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Test marks"
        description="Add a test, type each student's marks, and positions are worked out for you."
        actions={can(P.EXAMS_MARKS_ENTER) ? <Button disabled={sectionId === ""} onClick={() => setAdding(true)}>New test</Button> : undefined}
      />
      <ExportBar title="Test marks" />
      <Field id="tm-section" label="Section" className="max-w-xs">
        <SectionSelect id="tm-section" value={sectionId} onChange={setSectionId} />
      </Field>
      {sectionId === "" ? (
        <Empty title="Choose a section" />
      ) : (
        <Tabs defaultValue="tests">
          <TabsList>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="overall">Overall positions</TabsTrigger>
          </TabsList>
          <TabsContent value="tests" className="mt-4">
            <TestList sectionId={sectionId} />
          </TabsContent>
          <TabsContent value="overall" className="mt-4">
            <Overall sectionId={sectionId} />
          </TabsContent>
        </Tabs>
      )}
      {adding && sectionId !== "" && <NewTestDialog sectionId={sectionId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function TestList({ sectionId }: { sectionId: number }) {
  const list = useQuery({ queryKey: ["test-marks", "list", sectionId], queryFn: () => testMarks.list(sectionId) });
  if (list.isPending && list.fetchStatus === "paused") return <OfflineNotSaved what="The tests of this section are" />;
  if (list.isPending) return <Loading />;
  if (list.isError && !list.data) {
    return isNetworkError(list.error) ? <OfflineNotSaved what="The tests of this section are" /> : <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  }
  if (list.data.length === 0) return <Empty title="No tests in this section yet" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Test</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead className="text-right">Out of</TableHead>
          <TableHead className="text-right">Marks entered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.data.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="whitespace-nowrap">{formatDate(t.testDate)}</TableCell>
            <TableCell>
              <Link href={`/app/marks/test?id=${t.id}`} className="font-medium hover:underline">{t.name}</Link>
            </TableCell>
            <TableCell>{t.subjectName}</TableCell>
            <TableCell className="text-right tabular-nums">{t.maxMarks}</TableCell>
            <TableCell className="text-right tabular-nums">{t.entered}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NewTestDialog({ sectionId, onClose }: { sectionId: number; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: ["academics", "subjects"], queryFn: academics.subjects });
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [testDate, setTestDate] = useState(today);
  const [maxMarks, setMaxMarks] = useState("");
  const save = useMutation({
    mutationFn: () => testMarks.create({ sectionId, subjectId: Number(subjectId), name, testDate, maxMarks }),
    onSuccess: (sheet) => {
      void queryClient.invalidateQueries({ queryKey: ["test-marks"] });
      onClose();
      router.push(`/app/marks/test?id=${sheet.test?.id}`);
    },
    onError,
  });
  const ready = subjectId !== "" && name.trim() && testDate && maxMarks.trim();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New test</DialogTitle>
            <DialogDescription>You will type the marks on the next page.</DialogDescription>
          </DialogHeader>
          <Field id="nt-subject" label="Subject">
            <NativeSelect id="nt-subject" required value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose a subject</option>
              {(subjects.data ?? []).filter((s) => s.status === "ACTIVE").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field id="nt-name" label="Test name">
            <Input id="nt-name" required maxLength={100} placeholder="Monthly test" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="nt-date" label="Date">
              <Input id="nt-date" type="date" required max={today()} value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </Field>
            <Field id="nt-max" label="Out of">
              <Input id="nt-max" required inputMode="decimal" placeholder="100" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || save.isPending}>{save.isPending ? "Saving…" : "Add test"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One test: type the marks and see the positions. */
export function TestSheetPage() {
  // /app/marks/test?id=12 (a fixed page that opens offline); the older /app/marks/12 still works
  const params = useParams<{ id?: string }>();
  const search = useSearchParams();
  const id = Number(search.get("id") ?? params.id);
  const sheet = useQuery({ queryKey: ["test-marks", "sheet", id], queryFn: () => testMarks.sheet(id) });
  if (sheet.isPending && sheet.fetchStatus === "paused") return <OfflineNotSaved what="This mark sheet is" />;
  if (sheet.isPending) return <Loading />;
  // Offline: the copy saved on this device is used when it cannot be refreshed
  if (sheet.isError && !sheet.data) {
    return isNetworkError(sheet.error) ? <OfflineNotSaved what="This mark sheet is" /> : <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />;
  }
  return <Sheet key={sheet.dataUpdatedAt} sheet={sheet.data} />;
}

function OfflineNotSaved({ what }: { what: string }) {
  return (
    <Alert>
      <CloudOff aria-hidden />
      <AlertTitle>No internet: {what.toLowerCase()} not saved on this device</AlertTitle>
      <AlertDescription>
        Tests from the last two weeks are kept on the device automatically while online. Open this again when the internet is back.
      </AlertDescription>
    </Alert>
  );
}

type Entry = { value: string; absent: boolean };

function Sheet({ sheet }: { sheet: TestSheet }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const test = sheet.test;
  const id = test?.id ?? 0;
  const rows = sheet.rows ?? [];
  const max = Number(test?.maxMarks);
  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(rows.map((r) => [r.studentId ?? 0, { value: r.obtained ?? "", absent: r.absent ?? false }])),
  );
  const [reason, setReason] = useState("");
  const set = (studentId: number, patch: Partial<Entry>) => setEntries((all) => ({ ...all, [studentId]: { ...all[studentId], ...patch } }));
  const invalid = rows.filter((r) => {
    const e = entries[r.studentId ?? 0];
    const n = Number(e.value);
    return !e.absent && e.value.trim() !== "" && (Number.isNaN(n) || n < 0 || n > max);
  });
  // A saved mark that has been changed or cleared needs a reason
  const changedSaved = rows.some((r) => {
    if (r.obtained == null && !r.absent) return false;
    const e = entries[r.studentId ?? 0];
    return e.absent !== (r.absent ?? false) || (!e.absent && Number(e.value) !== Number(r.obtained)) || (!e.absent && e.value.trim() === "");
  });
  const sync = useSyncState();
  const path = `/test-marks/${id}/marks`;
  const waiting = sync.changes.find((c) => c.path === path);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        marks: rows.map((r) => {
          const e = entries[r.studentId ?? 0];
          return { studentId: r.studentId ?? 0, absent: e.absent, obtained: !e.absent && e.value.trim() ? e.value.trim() : undefined };
        }),
        reason: reason.trim() || undefined,
      };
      return saveOrQueue(() => testMarks.save(id, body), {
        kind: "marks",
        label: `Marks · ${test?.name} · ${test?.subjectName} · ${test?.sectionLabel}`,
        method: "PUT",
        path,
        body,
        meta: { testId: id },
      });
    },
    onSuccess: (saved) => {
      if (!saved.sent) {
        // Show the offline marks when the sheet is opened again on this device
        queryClient.setQueryData<TestSheet>(["test-marks", "sheet", id], (old) =>
          old
            ? {
                ...old,
                rows: (old.rows ?? []).map((r) => {
                  const e = entries[r.studentId ?? 0];
                  return e ? { ...r, absent: e.absent, obtained: !e.absent && e.value.trim() ? e.value.trim() : undefined } : r;
                }),
              }
            : old,
        );
        toast.success("Saved on this device. The marks will be sent when the internet is back.");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["test-marks"] });
      toast.success("Marks saved");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => testMarks.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["test-marks", "list"] });
      toast.success("Test deleted");
      router.push("/app/marks");
    },
    onError,
  });
  const can = useCan();
  const notify = useMutation({
    mutationFn: () => testMarks.sendToFamilies(id),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      const parts = [
        `${r.queued} SMS queued`,
        r.alreadySent ? `${r.alreadySent} already sent` : "",
        r.noPhone ? `${r.noPhone} without a phone` : "",
        r.noMarks ? `${r.noMarks} without marks` : "",
      ].filter(Boolean);
      toast.success(parts.join(", "));
    },
    onError,
  });
  const editable = sheet.canEdit;
  const notEntered = rows.filter((r) => !entries[r.studentId ?? 0].absent && entries[r.studentId ?? 0].value.trim() === "").length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${test?.name} · ${test?.subjectName}`}
        description={`${test?.sectionLabel} · ${formatDate(test?.testDate)} · Out of ${test?.maxMarks}`}
        actions={
          <>
            {can(P.MESSAGES_SEND) && (test?.entered ?? 0) > 0 && (
              <Button variant="outline" disabled={notify.isPending} onClick={() => notify.mutate()}>
                {notify.isPending ? "Sending…" : "Send marks to parents"}
              </Button>
            )}
            {editable && test?.entered === 0 && (
              <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete test</Button>
            )}
            <Button variant="outline" render={<Link href="/app/marks" />}>All tests</Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No students in this section on the test date" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Marks</CardTitle>
            <CardDescription>{notEntered} not entered yet. Positions update when you save.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {waiting && (
              <Alert variant={waiting.state === "failed" ? "destructive" : "default"}>
                <CloudOff aria-hidden />
                <AlertTitle>{waiting.state === "failed" ? "Saved offline, but the server did not accept it" : "Saved on this device"}</AlertTitle>
                <AlertDescription>
                  {waiting.state === "failed" ? waiting.error : "These marks will be sent automatically when the internet is back."}
                </AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">GR no.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const studentId = r.studentId ?? 0;
                  const e = entries[studentId];
                  return (
                    <TableRow key={studentId}>
                      <TableCell className="tabular-nums text-muted-foreground">{r.grNo}</TableCell>
                      <TableCell>
                        <span className="font-medium">{r.name}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Marks for ${r.name}`}
                          aria-invalid={invalid.includes(r) || undefined}
                          inputMode="decimal"
                          className={cn("w-24 tabular-nums", invalid.includes(r) && "border-destructive")}
                          disabled={!editable || e.absent}
                          value={e.absent ? "" : e.value}
                          onChange={(ev) => set(studentId, { value: ev.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          aria-pressed={e.absent}
                          aria-label={`${r.name} was absent`}
                          disabled={!editable}
                          onClick={() => set(studentId, { absent: !e.absent })}
                          className={cn(
                            "h-8 rounded-md border px-2 text-xs font-medium disabled:opacity-60",
                            e.absent ? "bg-red-600 text-white" : "bg-background hover:bg-muted",
                          )}
                        >
                          Absent
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.percent ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{r.position ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {invalid.length > 0 && (
              <p className="text-sm text-destructive" role="alert">
                {invalid.length === 1 ? "One mark is" : `${invalid.length} marks are`} not a number between 0 and {test?.maxMarks}.
              </p>
            )}
            {editable && changedSaved && (
              <Field id="tm-reason" label="Reason for changing saved marks">
                <Textarea id="tm-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            {editable && (
              <div>
                <Button disabled={save.isPending || invalid.length > 0 || (changedSaved && !reason.trim())} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : "Save marks"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function monthAgo() {
  const d = new Date(`${today()}T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Overall({ sectionId }: { sectionId: number }) {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const rows = useQuery({
    queryKey: ["test-marks", "overall", sectionId, from, to],
    queryFn: () => testMarks.overall(sectionId, from, to),
    enabled: Boolean(from && to),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ov-from" label="From"><Input id="ov-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="ov-to" label="To"><Input id="ov-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <p className="text-sm text-muted-foreground">
        Ranked by percentage over the tests each student has marks in. Absent counts as 0; the Tests column shows who missed any.
      </p>
      {rows.isPending ? (
        <Loading />
      ) : rows.isError ? (
        <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
      ) : rows.data.length === 0 ? (
        <Empty title="No marks in these dates" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Position</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="text-right font-semibold tabular-nums">{r.position}</TableCell>
                <TableCell><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">GR {r.grNo}</span></TableCell>
                <TableCell className="text-right tabular-nums">{r.tests} of {r.testsHeld}</TableCell>
                <TableCell className="text-right tabular-nums">{r.totalObtained}/{r.totalMax}</TableCell>
                <TableCell className="text-right tabular-nums">{r.percent}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** A student's test marks and positions, for the profile. */
export function StudentTestMarks({ studentId }: { studentId: number }) {
  const rows = useQuery({ queryKey: ["test-marks", "student", studentId], queryFn: () => testMarks.forStudent(studentId) });
  if (rows.isPending) return <Loading />;
  if (rows.isError) return <ErrorState error={rows.error} onRetry={() => rows.refetch()} />;
  if (rows.data.length === 0) return <Empty title="No test marks yet" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Test</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Section</TableHead>
          <TableHead className="text-right">Marks</TableHead>
          <TableHead className="text-right">Position</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.data.map((r) => (
          <TableRow key={r.testId}>
            <TableCell className="whitespace-nowrap">{formatDate(r.testDate)}</TableCell>
            <TableCell><Link href={`/app/marks/test?id=${r.testId}`} className="font-medium hover:underline">{r.testName}</Link></TableCell>
            <TableCell>{r.subjectName}</TableCell>
            <TableCell>{r.sectionLabel}</TableCell>
            <TableCell className="text-right tabular-nums">{r.absent ? "Absent" : `${r.obtained}/${r.maxMarks}`}</TableCell>
            <TableCell className="text-right tabular-nums">{r.position ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
