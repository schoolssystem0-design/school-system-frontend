"use client";

import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl, type Schemas } from "@/lib/api/client";
import { GENDERS, today, UploadButton } from "@/features/people/shared";

export type StaffFields = {
  category: string;
  name: string;
  fatherOrHusbandName: string;
  gender: string;
  dob: string;
  cnic: string;
  phone: string;
  email: string;
  address: string;
  qualification: string;
  experience: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  notes: string;
  photoFileId: number | null;
};

export function staffFrom(d?: Schemas["StaffDetails"]): StaffFields {
  return {
    category: d?.category ?? "TEACHER",
    name: d?.name ?? "",
    fatherOrHusbandName: d?.fatherOrHusbandName ?? "",
    gender: d?.gender ?? "",
    dob: d?.dob ?? "",
    cnic: d?.cnic ?? "",
    phone: d?.phone ?? "",
    email: d?.email ?? "",
    address: d?.address ?? "",
    qualification: d?.qualification ?? "",
    experience: d?.experience ?? "",
    designation: d?.designation ?? "",
    employmentType: d?.employmentType ?? "PERMANENT",
    joiningDate: d?.joiningDate ?? today(),
    notes: d?.notes ?? "",
    photoFileId: d?.photoFileId ?? null,
  };
}

export function staffBody(f: StaffFields): Schemas["StaffRequest"] {
  const text = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    category: f.category,
    name: f.name.trim(),
    fatherOrHusbandName: text(f.fatherOrHusbandName),
    gender: text(f.gender),
    dob: text(f.dob),
    cnic: text(f.cnic),
    phone: text(f.phone),
    email: text(f.email),
    address: text(f.address),
    qualification: text(f.qualification),
    experience: text(f.experience),
    designation: f.designation.trim(),
    employmentType: f.employmentType,
    joiningDate: f.joiningDate,
    notes: text(f.notes),
    photoFileId: f.photoFileId ?? undefined,
  };
}

/** A staff member's record (FR 3.1). */
export function StaffForm({ value, onChange }: { value: StaffFields; onChange: (v: StaffFields) => void }) {
  const set = (key: keyof StaffFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const photo = fileUrl(value.photoFileId);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Staff photo" className="size-20 rounded-md border object-cover" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md border text-xs text-muted-foreground">No photo</div>
        )}
        <UploadButton
          purpose="PHOTO"
          accept="image/png,image/jpeg,image/webp"
          label={photo ? "Change photo" : "Upload photo"}
          onUploaded={(fileId) => onChange({ ...value, photoFileId: fileId })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="sf-name" label="Full name">
          <Input id="sf-name" required maxLength={200} value={value.name} onChange={set("name")} />
        </Field>
        <Field id="sf-father" label="Father's / husband's name">
          <Input id="sf-father" maxLength={200} value={value.fatherOrHusbandName} onChange={set("fatherOrHusbandName")} />
        </Field>
        <Field id="sf-gender" label="Gender">
          <NativeSelect id="sf-gender" value={value.gender} onChange={set("gender")}>
            <option value="">Not given</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="sf-category" label="Staff type">
          <NativeSelect id="sf-category" value={value.category} onChange={set("category")}>
            <option value="TEACHER">Teacher</option>
            <option value="OTHER">Other staff</option>
          </NativeSelect>
        </Field>
        <Field id="sf-designation" label="Designation" hint="e.g. Senior Teacher, Accountant, Peon">
          <Input id="sf-designation" required maxLength={100} value={value.designation} onChange={set("designation")} />
        </Field>
        <Field id="sf-employment" label="Employment">
          <NativeSelect id="sf-employment" value={value.employmentType} onChange={set("employmentType")}>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
          </NativeSelect>
        </Field>
        <Field id="sf-joining" label="Joining date">
          <Input id="sf-joining" type="date" required value={value.joiningDate} onChange={set("joiningDate")} />
        </Field>
        <Field id="sf-dob" label="Date of birth">
          <Input id="sf-dob" type="date" value={value.dob} onChange={set("dob")} />
        </Field>
        <Field id="sf-cnic" label="CNIC">
          <Input id="sf-cnic" maxLength={20} value={value.cnic} onChange={set("cnic")} />
        </Field>
        <Field id="sf-phone" label="Mobile">
          <Input id="sf-phone" inputMode="tel" maxLength={30} value={value.phone} onChange={set("phone")} />
        </Field>
        <Field id="sf-email" label="Email">
          <Input id="sf-email" type="email" maxLength={254} value={value.email} onChange={set("email")} />
        </Field>
        <Field id="sf-qualification" label="Qualification">
          <Input id="sf-qualification" maxLength={200} value={value.qualification} onChange={set("qualification")} />
        </Field>
        <Field id="sf-experience" label="Experience">
          <Input id="sf-experience" maxLength={200} value={value.experience} onChange={set("experience")} />
        </Field>
        <Field id="sf-address" label="Address" className="sm:col-span-2">
          <Input id="sf-address" maxLength={500} value={value.address} onChange={set("address")} />
        </Field>
        <Field id="sf-notes" label="Notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="sf-notes" rows={2} maxLength={1000} value={value.notes} onChange={set("notes")} />
        </Field>
      </div>
    </div>
  );
}
