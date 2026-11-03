"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, fileUrl, openBlob } from "@/lib/api/client";
import { students, type FamilyRow, type Student } from "@/lib/api/people";
import { fees } from "@/lib/api/fees";
import { formatDate, formatMoney } from "@/lib/format";
import { toPaisa } from "@/lib/money";
import { P } from "@/lib/permissions";
import { FamilyPicker } from "@/features/families/family-picker";
import { label, SectionSelect, today, useCan } from "@/features/people/shared";
import { studentBody, StudentForm, studentFrom } from "./student-form";
import { LeavePage } from "@/features/attendance/leave-page";
import { StudentAttendance } from "@/features/attendance/reports-page";
import { StudentTestMarks } from "@/features/exams/test-marks-page";
import { StudentFees } from "@/features/fees/student-fees";
import { Activities, Certificates, Contacts, Documents } from "./student-records";

/** The student's profile (FR 5.1–5.8): details, class history, family, documents, activities and certificates. */
export function StudentProfile() {
  const id = Number(useParams<{ id: string }>().id);
  const student = useQuery({ queryKey: ["students", id], queryFn: () => students.get(id) });
  if (student.isPending) return <Loading />;
  if (student.isError) return <ErrorState error={student.error} onRetry={() => student.refetch()} />;
  return <Profile student={student.data} />;
}

type Action = "move" | "withdraw" | "readmit" | null;

function Profile({ student }: { student: Student }) {
  const can = useCan();
  const id = student.id ?? 0;
  const [action, setAction] = useState<Action>(null);
  const bio = useMutation({
    mutationFn: () => students.bioData(id),
    onSuccess: (blob) => openBlob(blob, `bio-data-${student.grNo}.pdf`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const active = student.status === "ACTIVE";
  const photo = fileUrl(student.details?.photoFileId);
  const current = student.currentClass;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-16 rounded-md border object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <PageHeader
            title={student.details?.name ?? "Student"}
            description={[
              `GR no. ${student.grNo}`,
              current ? `${current.className} - ${current.sectionName}` : null,
              current?.rollNo ? `Roll no. ${current.rollNo}` : null,
              `Admitted ${formatDate(student.admissionDate)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <>
                <Badge variant={active ? "default" : "secondary"}>
                  {active ? "Studying" : `Left ${formatDate(student.leftDate)}`}
                </Badge>
                {can(P.STUDENTS_PRINT) && (
                  <Button variant="outline" disabled={bio.isPending} onClick={() => bio.mutate()}>
                    <FileText aria-hidden /> Bio-data
                  </Button>
                )}
                {can(P.STUDENTS_MOVE) && active && (
                  <>
                    <Button variant="outline" onClick={() => setAction("move")}>
                      Change section
                    </Button>
                    <Button variant="destructive" onClick={() => setAction("withdraw")}>
                      Withdraw
                    </Button>
                  </>
                )}
                {can(P.STUDENTS_MOVE) && !active && <Button onClick={() => setAction("readmit")}>Re-admit</Button>}
              </>
            }
          />
        </div>
      </div>
      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Class history</TabsTrigger>
          <TabsTrigger value="family">Family &amp; contacts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activities">Houses, clubs &amp; achievements</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          {can(P.FEES_VIEW) && <TabsTrigger value="fees">Fees</TabsTrigger>}
          {can(P.ATTENDANCE_VIEW) && <TabsTrigger value="attendance">Attendance &amp; leave</TabsTrigger>}
          {can(P.EXAMS_VIEW) && <TabsTrigger value="marks">Test marks</TabsTrigger>}
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Details key={student.version} student={student} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <History id={id} />
        </TabsContent>
        <TabsContent value="family" className="mt-4 flex flex-col gap-6">
          <FamilyCard student={student} />
          <Contacts id={id} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Documents id={id} />
        </TabsContent>
        <TabsContent value="activities" className="mt-4">
          <Activities id={id} />
        </TabsContent>
        {can(P.ATTENDANCE_VIEW) && (
          <TabsContent value="attendance" className="mt-4 flex flex-col gap-6">
            <StudentAttendance studentId={id} />
            <LeavePage personType="STUDENT" personId={id} />
          </TabsContent>
        )}
        {can(P.EXAMS_VIEW) && (
          <TabsContent value="marks" className="mt-4">
            <StudentTestMarks studentId={id} />
          </TabsContent>
        )}
        {can(P.FEES_VIEW) && (
          <TabsContent value="fees" className="mt-4">
            <StudentFees studentId={id} familyId={student.family?.id ?? undefined} />
          </TabsContent>
        )}
        <TabsContent value="certificates" className="mt-4">
          <Certificates student={student} />
        </TabsContent>
      </Tabs>
      {action && <ActionDialog student={student} action={action} onClose={() => setAction(null)} />}
    </div>
  );
}

function Details({ student }: { student: Student }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(studentFrom(student.details));
  const [grNo, setGrNo] = useState(student.grNo ?? "");
  const manage = can(P.STUDENTS_MANAGE);
  const save = useMutation({
    mutationFn: () =>
      students.update(student.id ?? 0, { student: studentBody(value), grNo: grNo.trim(), version: student.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {student.privateHidden && (
            <Alert>
              <AlertDescription>B-Form, phone and address are hidden for your role.</AlertDescription>
            </Alert>
          )}
          <fieldset disabled={!manage} className="flex flex-col gap-4">
            <Field id="sp-gr" label="GR no." className="max-w-48" hint="Changing it is recorded in the activity history">
              <Input id="sp-gr" required maxLength={20} value={grNo} onChange={(e) => setGrNo(e.target.value)} />
            </Field>
            <StudentForm idPrefix="sp" value={value} onChange={setValue} privateHidden={student.privateHidden} />
          </fieldset>
          {manage && (
            <div>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save details"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function History({ id }: { id: number }) {
  const history = useQuery({ queryKey: ["students", id, "enrolments"], queryFn: () => students.enrolments(id) });
  if (history.isPending) return <Loading />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Roll no.</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>How</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.yearName}</TableCell>
                <TableCell>
                  {e.className} - {e.sectionName}
                </TableCell>
                <TableCell>{e.rollNo ?? "—"}</TableCell>
                <TableCell>{formatDate(e.effectiveFrom)}</TableCell>
                <TableCell>{e.effectiveTo ? formatDate(e.effectiveTo) : "Now"}</TableCell>
                <TableCell>{label(e.kind)}</TableCell>
                <TableCell className="max-w-64 truncate">{e.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FamilyCard({ student }: { student: Student }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  const [picked, setPicked] = useState<FamilyRow | null>(null);
  const family = student.family;
  const change = useMutation({
    mutationFn: () => students.changeFamily(student.id ?? 0, picked?.id ?? 0),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      setChanging(false);
      toast.success("Family changed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Family</CardTitle>
        <div className="flex gap-2">
          {family && can(P.FAMILIES_VIEW) && (
            <Button size="sm" variant="outline" render={<Link href={`/app/families/${family.id}`} />}>
              Open family
            </Button>
          )}
          {can(P.STUDENTS_MANAGE) && can(P.FAMILIES_MANAGE) && (
            <Button size="sm" variant="outline" onClick={() => setChanging(true)}>
              Link to another family
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {family ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">Family no.</dt>
            <dd>{family.familyNo}</dd>
            <dt className="text-muted-foreground">Father</dt>
            <dd>
              {family.fatherName ?? "—"} {family.fatherPhone && <span className="text-muted-foreground">· {family.fatherPhone}</span>}
            </dd>
            <dt className="text-muted-foreground">Mother</dt>
            <dd>
              {family.motherName ?? "—"} {family.motherPhone && <span className="text-muted-foreground">· {family.motherPhone}</span>}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No family linked.</p>
        )}
      </CardContent>
      <Dialog open={changing} onOpenChange={setChanging}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to another family</DialogTitle>
            <DialogDescription>
              Use this when the student was linked to the wrong family. Fees and messages will follow the new family.
            </DialogDescription>
          </DialogHeader>
          <FamilyPicker id="change-family" selected={picked} onSelect={setPicked} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChanging(false)}>
              Cancel
            </Button>
            <Button disabled={!picked || change.isPending} onClick={() => change.mutate()}>
              {change.isPending ? "Saving…" : "Link to this family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ActionDialog({ student, action, onClose }: { student: Student; action: Exclude<Action, null>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const id = student.id ?? 0;
  const [sectionId, setSectionId] = useState<number | "">("");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => {
      if (action === "move") return students.move(id, { toSectionId: Number(sectionId), effectiveDate: date, reason });
      if (action === "withdraw") return students.withdraw(id, { leavingDate: date, reason });
      return students.readmit(id, { sectionId: Number(sectionId), date, reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(
        action === "move" ? "Section changed" : action === "withdraw" ? "Withdrawal recorded" : "Student re-admitted",
      );
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const titles = {
    move: "Change section",
    withdraw: `Withdraw ${student.details?.name}`,
    readmit: `Re-admit ${student.details?.name}`,
  };
  const needsSection = action !== "withdraw";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{titles[action]}</DialogTitle>
            <DialogDescription>
              {action === "move"
                ? "Attendance, marks and fees from this date go to the new section. Earlier records stay where they were."
                : action === "withdraw"
                  ? "The student keeps their GR number and full history and moves to the leavers list. Nothing is deleted."
                  : "The student returns with the same GR number and history."}
            </DialogDescription>
          </DialogHeader>
          {action === "withdraw" && <OutstandingFees studentId={id} />}
          {needsSection && (
            <Field id="act-section" label="New class and section">
              <SectionSelect id="act-section" required value={sectionId} onChange={setSectionId} />
            </Field>
          )}
          <Field id="act-date" label={action === "withdraw" ? "Leaving date" : "From date"}>
            <Input id="act-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="act-reason" label="Reason">
            <Textarea
              id="act-reason"
              rows={2}
              maxLength={500}
              required={action === "withdraw"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action === "withdraw" ? "destructive" : "default"}
              disabled={run.isPending || (needsSection && sectionId === "")}
            >
              {run.isPending ? "Saving…" : action === "move" ? "Change section" : action === "withdraw" ? "Withdraw" : "Re-admit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shown when withdrawing (FR 5.6): fees still owed, so they can be collected, carried or written off first. */
function OutstandingFees({ studentId }: { studentId: number }) {
  const can = useCan();
  const ledger = useQuery({
    queryKey: ["fees", "student-ledger", studentId],
    queryFn: () => fees.studentLedger(studentId),
    enabled: can(P.FEES_VIEW),
  });
  if (!ledger.data || toPaisa(ledger.data.owed) <= 0n) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {formatMoney(ledger.data.owed)} in fees is still owed. Collect it, keep it on the family&apos;s account, or write it off as
        bad debt from the student&apos;s Fees tab.
      </AlertDescription>
    </Alert>
  );
}
