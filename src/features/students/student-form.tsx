"use client";

import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Schemas } from "@/lib/api/client";
import { fileUrl } from "@/lib/api/client";
import { GENDERS, UploadButton } from "@/features/people/shared";

export type StudentFields = {
  name: string;
  gender: string;
  dob: string;
  bFormNo: string;
  placeOfBirth: string;
  religion: string;
  nationality: string;
  phone: string;
  address: string;
  previousSchool: string;
  studyGroup: string;
  seatNo: string;
  notes: string;
  photoFileId: number | null;
};

export function studentFrom(details?: Schemas["StudentDetails"]): StudentFields {
  return {
    name: details?.name ?? "",
    gender: details?.gender ?? "",
    dob: details?.dob ?? "",
    bFormNo: details?.bFormNo ?? "",
    placeOfBirth: details?.placeOfBirth ?? "",
    religion: details?.religion ?? "Islam",
    nationality: details?.nationality ?? "Pakistani",
    phone: details?.phone ?? "",
    address: details?.address ?? "",
    previousSchool: details?.previousSchool ?? "",
    studyGroup: details?.studyGroup ?? "",
    seatNo: details?.seatNo ?? "",
    notes: details?.notes ?? "",
    photoFileId: details?.photoFileId ?? null,
  };
}

export function studentBody(f: StudentFields): Schemas["StudentInput"] {
  const { photoFileId, ...text } = f;
  const body: Partial<Schemas["StudentInput"]> = Object.fromEntries(
    Object.entries(text).filter(([, v]) => v.trim() !== ""),
  );
  return { ...body, name: f.name, gender: f.gender, photoFileId: photoFileId ?? undefined };
}

/** A student's own details (FR 5.1). Private fields are hidden for roles without the private-view permission. */
export function StudentForm({
  idPrefix,
  value,
  onChange,
  privateHidden,
  showSchoolFields = true,
}: {
  idPrefix: string;
  value: StudentFields;
  onChange: (value: StudentFields) => void;
  privateHidden?: boolean;
  showSchoolFields?: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const set = (key: keyof StudentFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const photo = fileUrl(value.photoFileId);
  const shown = !privateHidden;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Student photo" className="size-20 rounded-md border object-cover" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md border text-xs text-muted-foreground">
            No photo
          </div>
        )}
        <UploadButton
          purpose="PHOTO"
          accept="image/png,image/jpeg,image/webp"
          label={photo ? "Change photo" : "Upload photo"}
          onUploaded={(fileId) => onChange({ ...value, photoFileId: fileId })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={id("name")} label="Full name">
          <Input id={id("name")} required maxLength={200} value={value.name} onChange={set("name")} />
        </Field>
        <Field id={id("gender")} label="Gender">
          <NativeSelect id={id("gender")} required value={value.gender} onChange={set("gender")}>
            <option value="">Choose</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={id("dob")} label="Date of birth">
          <Input id={id("dob")} type="date" value={value.dob} onChange={set("dob")} />
        </Field>
        {shown && (
          <Field id={id("bform")} label="B-Form no." hint="13 digits">
            <Input id={id("bform")} maxLength={20} value={value.bFormNo} onChange={set("bFormNo")} />
          </Field>
        )}
        <Field id={id("pob")} label="Place of birth">
          <Input id={id("pob")} maxLength={100} value={value.placeOfBirth} onChange={set("placeOfBirth")} />
        </Field>
        <Field id={id("religion")} label="Religion">
          <Input id={id("religion")} maxLength={50} value={value.religion} onChange={set("religion")} />
        </Field>
        <Field id={id("nationality")} label="Nationality">
          <Input id={id("nationality")} maxLength={50} value={value.nationality} onChange={set("nationality")} />
        </Field>
        {shown && (
          <Field id={id("phone")} label="Student's phone">
            <Input id={id("phone")} inputMode="tel" maxLength={30} value={value.phone} onChange={set("phone")} />
          </Field>
        )}
        <Field id={id("prev")} label="Previous school">
          <Input id={id("prev")} maxLength={200} value={value.previousSchool} onChange={set("previousSchool")} />
        </Field>
        {shown && (
          <Field id={id("address")} label="Address (if different from family)" className="sm:col-span-2 lg:col-span-3">
            <Input id={id("address")} maxLength={500} value={value.address} onChange={set("address")} />
          </Field>
        )}
        {showSchoolFields && (
          <>
            <Field id={id("group")} label="Study group" hint="e.g. Science, Computer, Arts">
              <Input id={id("group")} maxLength={50} value={value.studyGroup} onChange={set("studyGroup")} />
            </Field>
            <Field id={id("seat")} label="Board seat no.">
              <Input id={id("seat")} maxLength={30} value={value.seatNo} onChange={set("seatNo")} />
            </Field>
            <Field id={id("notes")} label="Notes" className="sm:col-span-2 lg:col-span-3">
              <Textarea id={id("notes")} rows={2} maxLength={1000} value={value.notes} onChange={set("notes")} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}
