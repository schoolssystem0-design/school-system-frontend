"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Schemas } from "@/lib/api/client";
import { admissions } from "@/lib/api/people";
import { ClassSelect, GENDERS, today } from "@/features/people/shared";

export type EnquiryFields = {
  enquiryDate: string;
  source: string;
  childName: string;
  gender: string;
  dob: string;
  classAppliedId: number | "";
  parentName: string;
  parentPhone: string;
  parentCnic: string;
  address: string;
  previousSchool: string;
  remarks: string;
};

export function enquiryFrom(d?: Schemas["EnquiryDetails"]): EnquiryFields {
  return {
    enquiryDate: d?.enquiryDate ?? today(),
    source: d?.source ?? "WALK_IN",
    childName: d?.childName ?? "",
    gender: d?.gender ?? "",
    dob: d?.dob ?? "",
    classAppliedId: d?.classAppliedId ?? "",
    parentName: d?.parentName ?? "",
    parentPhone: d?.parentPhone ?? "",
    parentCnic: d?.parentCnic ?? "",
    address: d?.address ?? "",
    previousSchool: d?.previousSchool ?? "",
    remarks: d?.remarks ?? "",
  };
}

export function enquiryBody(f: EnquiryFields): Schemas["EnquiryRequest"] {
  const text = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    enquiryDate: f.enquiryDate,
    source: f.source,
    childName: f.childName.trim(),
    gender: text(f.gender),
    dob: text(f.dob),
    classAppliedId: f.classAppliedId === "" ? undefined : f.classAppliedId,
    parentName: text(f.parentName),
    parentPhone: text(f.parentPhone),
    parentCnic: text(f.parentCnic),
    address: text(f.address),
    previousSchool: text(f.previousSchool),
    remarks: text(f.remarks),
  };
}

/** Enquiry details (FR 4.1). */
export function EnquiryForm({
  idPrefix,
  value,
  onChange,
  contactsHidden,
}: {
  idPrefix: string;
  value: EnquiryFields;
  onChange: (value: EnquiryFields) => void;
  contactsHidden?: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const set = (key: keyof EnquiryFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field id={id("child")} label="Child's name">
        <Input id={id("child")} required maxLength={200} value={value.childName} onChange={set("childName")} />
      </Field>
      <Field id={id("gender")} label="Gender">
        <NativeSelect id={id("gender")} value={value.gender} onChange={set("gender")}>
          <option value="">Not given</option>
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
      <Field id={id("class")} label="Class applied for">
        <ClassSelect
          id={id("class")}
          emptyLabel="Not decided"
          value={value.classAppliedId}
          onChange={(v) => onChange({ ...value, classAppliedId: v })}
        />
      </Field>
      <Field id={id("date")} label="Enquiry date">
        <Input id={id("date")} type="date" required value={value.enquiryDate} onChange={set("enquiryDate")} />
      </Field>
      <Field id={id("source")} label="How they came">
        <NativeSelect id={id("source")} value={value.source} onChange={set("source")}>
          <option value="WALK_IN">Walk-in</option>
          <option value="PHONE">Phone call</option>
          <option value="ONLINE">Online</option>
        </NativeSelect>
      </Field>
      <Field id={id("parent")} label="Parent's name">
        <Input id={id("parent")} maxLength={200} value={value.parentName} onChange={set("parentName")} />
      </Field>
      {!contactsHidden && (
        <>
          <Field id={id("phone")} label="Parent's mobile">
            <Input id={id("phone")} inputMode="tel" maxLength={30} value={value.parentPhone} onChange={set("parentPhone")} />
          </Field>
          <Field id={id("cnic")} label="Parent's CNIC">
            <Input id={id("cnic")} maxLength={20} value={value.parentCnic} onChange={set("parentCnic")} />
          </Field>
          <Field id={id("address")} label="Address" className="sm:col-span-2">
            <Input id={id("address")} maxLength={500} value={value.address} onChange={set("address")} />
          </Field>
        </>
      )}
      <Field id={id("prev")} label="Previous school">
        <Input id={id("prev")} maxLength={200} value={value.previousSchool} onChange={set("previousSchool")} />
      </Field>
      <Field id={id("remarks")} label="Remarks" className="sm:col-span-2 lg:col-span-3">
        <Textarea id={id("remarks")} rows={2} maxLength={1000} value={value.remarks} onChange={set("remarks")} />
      </Field>
    </div>
  );
}

/**
 * Warns when the child or parent may already be known: an earlier enquiry, a current student, or a family with the
 * same phone/CNIC (FR 4.5). Only a warning; staff decide.
 */
export function DuplicateWarning({ value, excludeEnquiryId }: { value: EnquiryFields; excludeEnquiryId?: number }) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 500);
    return () => clearTimeout(timer);
  }, [value]);
  const params = {
    name: debounced.childName.trim() || undefined,
    dob: debounced.dob || undefined,
    phone: debounced.parentPhone.trim() || undefined,
    cnic: debounced.parentCnic.trim() || undefined,
    excludeEnquiryId,
  };
  const enabled = (params.name?.length ?? 0) >= 3 || (params.phone?.length ?? 0) >= 10 || (params.cnic?.length ?? 0) >= 13;
  const matches = useQuery({
    queryKey: ["admissions", "duplicates", params],
    queryFn: () => admissions.duplicates(params),
    enabled,
  });
  if (!enabled || !matches.data || matches.data.length === 0) return null;
  return (
    <Alert>
      <AlertTitle>Possible duplicates</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex flex-col gap-1">
          {matches.data.map((m) => (
            <li key={`${m.kind}-${m.id}`}>
              <strong>{m.label}</strong> {m.detail && <span>· {m.detail}</span>}{" "}
              <span className="text-muted-foreground">({m.reason})</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
