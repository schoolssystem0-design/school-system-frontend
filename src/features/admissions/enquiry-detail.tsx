"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, openBlob } from "@/lib/api/client";
import { admissions, students, type Enquiry, type FamilyRow } from "@/lib/api/people";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { emptyFamily, familyBody, FamilyForm } from "@/features/families/family-form";
import { FamilyPicker } from "@/features/families/family-picker";
import { SectionSelect, today, useCan } from "@/features/people/shared";
import { StatusBadge } from "./admissions-page";
import { DuplicateWarning, enquiryBody, EnquiryForm, enquiryFrom } from "./enquiry-form";

const onError = (e: unknown) => toast.error(errorMessage(e));

export function EnquiryDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const enquiry = useQuery({ queryKey: ["admissions", "enquiry", id], queryFn: () => admissions.enquiry(id) });
  if (enquiry.isPending) return <Loading />;
  if (enquiry.isError) return <ErrorState error={enquiry.error} onRetry={() => enquiry.refetch()} />;
  return <EnquiryView key={enquiry.data.version} enquiry={enquiry.data} />;
}

function EnquiryView({ enquiry }: { enquiry: Enquiry }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const id = enquiry.id ?? 0;
  const manage = can(P.ADMISSIONS_MANAGE);
  const enrolled = enquiry.studentId != null;
  // The school confirms the admission (status "approved") before the child can be enrolled (FR 4.6).
  const approved = enquiry.status?.systemCode === "APPROVED";
  const [value, setValue] = useState(enquiryFrom(enquiry.details));
  const [enrolling, setEnrolling] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admissions"] });
  const save = useMutation({
    mutationFn: () => admissions.update(id, { ...enquiryBody(value), version: enquiry.version }),
    onSuccess: () => {
      void refresh();
      toast.success("Enquiry saved");
    },
    onError,
  });
  const form = useMutation({
    mutationFn: () => admissions.form({ enquiryId: id }),
    onSuccess: (blob) => openBlob(blob, `admission-form-${enquiry.registrationNo}.pdf`),
    onError,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={enquiry.details?.childName ?? "Enquiry"}
        description={`Enquiry ${enquiry.registrationNo} · ${formatDate(enquiry.details?.enquiryDate)}${enquiry.className ? ` · ${enquiry.className}` : ""}`}
        actions={
          <>
            <StatusBadge name={enquiry.status?.name} colour={enquiry.status?.colour} />
            <Button variant="outline" disabled={form.isPending} onClick={() => form.mutate()}>
              <FileDown aria-hidden /> Admission form
            </Button>
            {enrolled ? (
              <Button render={<Link href={`/app/students/${enquiry.studentId}`} />}>Open student</Button>
            ) : (
              can(P.ADMISSIONS_ENROL) && (
                <Button
                  disabled={!approved}
                  title={approved ? undefined : "Set the status to approved first"}
                  onClick={() => setEnrolling(true)}
                >
                  Enrol
                </Button>
              )
            )}
          </>
        }
      />
      {!enrolled && !approved && can(P.ADMISSIONS_ENROL) && (
        <p className="-mt-4 text-sm text-muted-foreground">
          To enrol, first change the status to approved under Follow-up.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <fieldset disabled={!manage || enrolled} className="contents">
                  <EnquiryForm idPrefix="enq" value={value} onChange={setValue} contactsHidden={enquiry.contactsHidden} />
                </fieldset>
                {!enrolled && can(P.ADMISSIONS_MANAGE) && <DuplicateWarning value={value} excludeEnquiryId={id} />}
                {manage && !enrolled && (
                  <div>
                    <Button type="submit" disabled={save.isPending}>
                      {save.isPending ? "Saving…" : "Save details"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
          <TestCard enquiry={enquiry} disabled={!manage || enrolled} />
        </div>
        <div className="flex flex-col gap-6">
          {!enrolled && manage && <StatusCard enquiry={enquiry} />}
          <Remarks id={id} manage={manage} />
        </div>
      </div>
      {enrolling && <EnrolDialog enquiry={enquiry} onClose={() => setEnrolling(false)} />}
    </div>
  );
}

function StatusCard({ enquiry }: { enquiry: Enquiry }) {
  const queryClient = useQueryClient();
  const statuses = useQuery({ queryKey: ["admissions", "statuses"], queryFn: admissions.statuses });
  const [statusId, setStatusId] = useState<number>(enquiry.status?.id ?? 0);
  const [remark, setRemark] = useState("");
  const change = useMutation({
    mutationFn: () => admissions.setStatus(enquiry.id ?? 0, { statusId, remark: remark || undefined }),
    onSuccess: () => {
      setRemark("");
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Status changed");
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-up</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          <Field id="enq-new-status" label="New status">
            <NativeSelect id="enq-new-status" value={statusId} onChange={(e) => setStatusId(Number(e.target.value))}>
              {(statuses.data ?? [])
                .filter((s) => s.active && s.systemCode !== "ENROLLED")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field id="enq-status-remark" label="Remark (optional)">
            <Textarea id="enq-status-remark" rows={2} maxLength={1000} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" disabled={change.isPending || statusId === enquiry.status?.id}>
              Change status
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TestCard({ enquiry, disabled }: { enquiry: Enquiry; disabled: boolean }) {
  const queryClient = useQueryClient();
  const t = enquiry.test;
  const [testDate, setTestDate] = useState(t?.testDate ?? "");
  const [obtained, setObtained] = useState(t?.obtained != null ? String(t.obtained) : "");
  const [total, setTotal] = useState(t?.total != null ? String(t.total) : "");
  const [remark, setRemark] = useState(t?.remark ?? "");
  const save = useMutation({
    mutationFn: () =>
      admissions.saveTest(enquiry.id ?? 0, {
        testDate: testDate || undefined,
        obtained: obtained === "" ? undefined : Number(obtained),
        total: total === "" ? undefined : Number(total),
        remark: remark || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Test result saved");
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admission test</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-4">
            <Field id="test-date" label="Test date">
              <Input id="test-date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </Field>
            <Field id="test-obtained" label="Marks obtained">
              <Input id="test-obtained" inputMode="decimal" value={obtained} onChange={(e) => setObtained(e.target.value)} />
            </Field>
            <Field id="test-total" label="Total marks">
              <Input id="test-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
            </Field>
            <Field id="test-remark" label="Remark">
              <Input id="test-remark" maxLength={500} value={remark} onChange={(e) => setRemark(e.target.value)} />
            </Field>
          </fieldset>
          {!disabled && (
            <div>
              <Button type="submit" variant="outline" disabled={save.isPending}>
                Save test result
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Remarks({ id, manage }: { id: number; manage: boolean }) {
  const queryClient = useQueryClient();
  const key = ["admissions", "enquiry", id, "remarks"];
  const remarks = useQuery({ queryKey: key, queryFn: () => admissions.remarks(id) });
  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: () => admissions.addRemark(id, text),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Remarks and calls</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {manage && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Textarea aria-label="New remark" rows={2} maxLength={1000} placeholder="e.g. Called father, will visit Monday" value={text} onChange={(e) => setText(e.target.value)} />
            <div>
              <Button type="submit" size="sm" disabled={!text.trim() || add.isPending}>
                Add remark
              </Button>
            </div>
          </form>
        )}
        {remarks.isPending ? (
          <Loading />
        ) : remarks.isError ? (
          <ErrorState error={remarks.error} />
        ) : remarks.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remarks yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {remarks.data.map((r) => (
              <li key={r.id} className="border-s-2 ps-3 text-sm">
                <p className="whitespace-pre-wrap">{r.text}</p>
                <p className="text-xs text-muted-foreground">
                  {r.byName} · {formatDateTime(r.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Enrol the enquiry as a student (FR 4.6): the child's details are carried over, nothing is typed twice. */
function EnrolDialog({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const d = enquiry.details;
  const suggested = useQuery({ queryKey: ["students", "suggest-gr"], queryFn: students.suggestGr });
  const [sectionId, setSectionId] = useState<number | "">("");
  const [grNo, setGrNo] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [admissionDate, setAdmissionDate] = useState(today);
  const [gender, setGender] = useState(d?.gender ?? "");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [newFamily, setNewFamily] = useState({
    ...emptyFamily(),
    fatherName: d?.parentName ?? "",
    fatherPhone: d?.parentPhone ?? "",
    fatherCnic: d?.parentCnic ?? "",
    address: d?.address ?? "",
  });
  const enrol = useMutation({
    mutationFn: () =>
      admissions.enrol(enquiry.id ?? 0, {
        sectionId: Number(sectionId),
        grNo: grNo.trim() || undefined,
        rollNo: rollNo.trim() || undefined,
        admissionDate,
        student: {
          name: d?.childName ?? "",
          gender,
          dob: d?.dob,
          previousSchool: d?.previousSchool,
        },
        familyId: mode === "existing" ? family?.id : undefined,
        newFamily: mode === "new" ? familyBody(newFamily) : undefined,
      }),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`${s.details?.name} enrolled with GR no. ${s.grNo}`);
      router.push(`/app/students/${s.id}`);
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            enrol.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Enrol {d?.childName}</DialogTitle>
            <DialogDescription>
              Creates the student record with a GR number and places the child in a section. More details can be added on
              the student&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          {enquiry.contactsHidden && (
            <Alert>
              <AlertDescription>Parent contact details are hidden for your role and will not be copied.</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="en-section" label="Class and section">
              <SectionSelect id="en-section" required value={sectionId} onChange={setSectionId} />
            </Field>
            <Field id="en-gender" label="Gender">
              <NativeSelect id="en-gender" required value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Choose</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </NativeSelect>
            </Field>
            <Field id="en-date" label="Admission date">
              <Input id="en-date" type="date" required value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
            </Field>
            <Field id="en-gr" label="GR no." hint={suggested.data ? `Next: ${suggested.data.grNo}` : undefined}>
              <Input id="en-gr" maxLength={20} placeholder={suggested.data?.grNo} value={grNo} onChange={(e) => setGrNo(e.target.value)} />
            </Field>
            <Field id="en-roll" label="Roll no.">
              <Input id="en-roll" maxLength={10} value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
            </Field>
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-2 font-medium">Family</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="en-family" checked={mode === "new"} onChange={() => setMode("new")} />
              New family
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="en-family" checked={mode === "existing"} onChange={() => setMode("existing")} />
              Brother or sister already studies here
            </label>
          </fieldset>
          {mode === "existing" ? (
            <FamilyPicker id="en-family-search" selected={family} onSelect={setFamily} />
          ) : (
            <FamilyForm idPrefix="en-fam" value={newFamily} onChange={setNewFamily} compact />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={enrol.isPending || sectionId === "" || !gender || (mode === "existing" && !family)}>
              {enrol.isPending ? "Enrolling…" : "Enrol student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
