"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { newKey } from "@/lib/api/fees";
import { students, type FamilyRow } from "@/lib/api/people";
import { saveOrQueue } from "@/lib/offline/save";
import { emptyFamily, familyBody, FamilyForm } from "@/features/families/family-form";
import { FamilyPicker } from "@/features/families/family-picker";
import { SectionSelect, today, useClasses, sectionOptions } from "@/features/people/shared";
import { useSyncState } from "@/features/shell/offline-bar";
import { GrNumberNote } from "./gr-number-note";
import { studentBody, StudentForm, studentFrom } from "./student-form";

/** Digits of a Pakistani mobile in one form (0300…), for matching the same family. */
function mobileDigits(raw: string | undefined | null) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) return `0${d.slice(2)}`;
  return d;
}

/**
 * Direct admission without an enquiry (FR 5.1). Enquiries are enrolled from their own page.
 * Without internet the admission is kept on this device and sent later (GR number given then); a brother or sister
 * admitted offline into the same new family joins it once the first admission is sent.
 */
export function AdmitPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sync = useSyncState();
  const classes = useClasses();
  const [student, setStudent] = useState(studentFrom());
  const [sectionId, setSectionId] = useState<number | "">("");
  const [admissionDate, setAdmissionDate] = useState(today);
  const [familyMode, setFamilyMode] = useState<"existing" | "new">("new");
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [newFamily, setNewFamily] = useState(emptyFamily());
  const [kept, setKept] = useState<{ name: string; section: string } | null>(null);

  const body = {
    student: studentBody(student),
    sectionId: Number(sectionId),
    admissionDate,
    familyId: familyMode === "existing" ? (family?.id ?? undefined) : undefined,
    newFamily: familyMode === "new" ? familyBody(newFamily) : undefined,
  };
  const bodyKey = JSON.stringify(body);
  // One key per distinct admission: sending it again (after a dropped connection) never admits the child twice.
  const idempotencyKey = useMemo(() => newKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A brother or sister already admitted offline into a new family with the same father's mobile
  const phone = familyMode === "new" ? mobileDigits(body.newFamily?.fatherPhone) : "";
  const siblingOffline =
    phone.length >= 10
      ? sync.changes.find(
          (c) =>
            c.kind === "admission" &&
            c.state === "waiting" &&
            !c.meta?.familyFrom &&
            mobileDigits((c.body as { newFamily?: { fatherPhone?: string } }).newFamily?.fatherPhone) === phone,
        )
      : undefined;
  const sectionLabel = sectionOptions(classes.data).find((s) => s.id === sectionId)?.label ?? "";

  const admit = useMutation({
    mutationFn: () =>
      saveOrQueue(() => students.admit(body, idempotencyKey), {
        kind: "admission",
        label: `Admission · ${student.name} · ${sectionLabel}`,
        method: "POST",
        path: "/students",
        body,
        idempotencyKey,
        meta: { familyFrom: siblingOffline?.id },
      }),
    onSuccess: (saved) => {
      if (!saved.sent) {
        setKept({ name: student.name, section: sectionLabel });
        return;
      }
      const s = saved.result;
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`${s.details?.name} admitted with GR no. ${s.grNo}`);
      router.push(`/app/students/${s.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const familyReady = familyMode === "new" || family != null;

  if (kept) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="New admission" />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Alert>
              <CloudOff aria-hidden />
              <AlertTitle>
                Saved on this device: {kept.name} for {kept.section}
              </AlertTitle>
              <AlertDescription>
                There is no internet. The admission will be sent automatically when the connection is back; the GR number
                and the family&apos;s welcome SMS come then. It will never be admitted twice.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setKept(null);
                  setStudent(studentFrom());
                  setFamily(null);
                  setNewFamily(emptyFamily());
                  setFamilyMode("new");
                }}
              >
                Admit another student
              </Button>
              <Button variant="outline" render={<Link href="/app/students" />}>
                Students
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        admit.mutate();
      }}
    >
      <PageHeader
        title="New admission"
        description="The student is placed in a section from the admission date. The GR number is given automatically."
        actions={
          <Button variant="outline" render={<Link href="/app/students" />}>
            Cancel
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Student</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentForm idPrefix="adm" value={student} onChange={setStudent} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Class and admission</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="adm-section" label="Class and section">
            <SectionSelect id="adm-section" required value={sectionId} onChange={setSectionId} />
          </Field>
          <Field id="adm-date" label="Admission date">
            <Input id="adm-date" type="date" required value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
          </Field>
          <GrNumberNote />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Family</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="family-mode" checked={familyMode === "new"} onChange={() => setFamilyMode("new")} />
              New family
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="family-mode"
                checked={familyMode === "existing"}
                onChange={() => setFamilyMode("existing")}
              />
              Brother or sister already studies here
            </label>
          </fieldset>
          {familyMode === "existing" ? (
            <FamilyPicker id="adm-family" selected={family} onSelect={setFamily} />
          ) : (
            <FamilyForm idPrefix="adm-fam" value={newFamily} onChange={setNewFamily} compact />
          )}
          {siblingOffline && (
            <p className="text-sm text-primary" role="status">
              Same father&apos;s mobile as an admission saved on this device ({siblingOffline.label.split(" · ")[1]}): both
              children will be in one family when they are sent.
            </p>
          )}
        </CardContent>
      </Card>
      <div>
        <Button type="submit" disabled={admit.isPending || sectionId === "" || !familyReady}>
          {admit.isPending ? "Admitting…" : "Admit student"}
        </Button>
      </div>
    </form>
  );
}
