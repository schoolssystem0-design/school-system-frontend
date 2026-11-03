"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { students, type FamilyRow } from "@/lib/api/people";
import { emptyFamily, familyBody, FamilyForm } from "@/features/families/family-form";
import { FamilyPicker } from "@/features/families/family-picker";
import { SectionSelect, today } from "@/features/people/shared";
import { studentBody, StudentForm, studentFrom } from "./student-form";

/** Direct admission without an enquiry (FR 5.1). Enquiries are enrolled from their own page. */
export function AdmitPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const suggested = useQuery({ queryKey: ["students", "suggest-gr"], queryFn: students.suggestGr });
  const [student, setStudent] = useState(studentFrom());
  const [sectionId, setSectionId] = useState<number | "">("");
  const [grNo, setGrNo] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [admissionDate, setAdmissionDate] = useState(today);
  const [familyMode, setFamilyMode] = useState<"existing" | "new">("new");
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [newFamily, setNewFamily] = useState(emptyFamily());

  const admit = useMutation({
    mutationFn: () =>
      students.admit({
        student: studentBody(student),
        sectionId: Number(sectionId),
        grNo: grNo.trim() || undefined,
        rollNo: rollNo.trim() || undefined,
        admissionDate,
        familyId: familyMode === "existing" ? (family?.id ?? undefined) : undefined,
        newFamily: familyMode === "new" ? familyBody(newFamily) : undefined,
      }),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`${s.details?.name} admitted with GR no. ${s.grNo}`);
      router.push(`/app/students/${s.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const familyReady = familyMode === "new" || family != null;

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
        description="The student is placed in a section from the admission date. A GR number is given automatically unless you type one."
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
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="adm-section" label="Class and section">
            <SectionSelect id="adm-section" required value={sectionId} onChange={setSectionId} />
          </Field>
          <Field id="adm-date" label="Admission date">
            <Input id="adm-date" type="date" required value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
          </Field>
          <Field id="adm-gr" label="GR no." hint={suggested.data ? `Next: ${suggested.data.grNo}` : undefined}>
            <Input id="adm-gr" maxLength={20} value={grNo} placeholder={suggested.data?.grNo} onChange={(e) => setGrNo(e.target.value)} />
          </Field>
          <Field id="adm-roll" label="Roll no.">
            <Input id="adm-roll" maxLength={10} value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
          </Field>
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
