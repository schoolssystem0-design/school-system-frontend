"use client";

import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Schemas } from "@/lib/api/client";

export type FamilyFields = {
  fatherName: string;
  fatherPhone: string;
  fatherCnic: string;
  fatherProfession: string;
  motherName: string;
  motherPhone: string;
  motherCnic: string;
  address: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  preferredChannel: string;
  remarks: string;
};

export function emptyFamily(): FamilyFields {
  return {
    fatherName: "",
    fatherPhone: "",
    fatherCnic: "",
    fatherProfession: "",
    motherName: "",
    motherPhone: "",
    motherCnic: "",
    address: "",
    email: "",
    emergencyName: "",
    emergencyPhone: "",
    preferredChannel: "SMS",
    remarks: "",
  };
}

export function familyFrom(details: Schemas["FamilyDetails"] | undefined): FamilyFields {
  const empty = emptyFamily();
  if (!details) return empty;
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, (details as Record<string, string | undefined>)[key] ?? empty[key as keyof FamilyFields]]),
  ) as FamilyFields;
}

/** Fields as a request body: blanks are left out. */
export function familyBody(fields: FamilyFields): Schemas["FamilyRequest"] {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== "")) as Schemas["FamilyRequest"];
}

/**
 * Parents and contact details of a family (FR 5.2). One family record is shared by all its children, so a phone
 * number changed here is changed for every sibling.
 */
export function FamilyForm({
  idPrefix,
  value,
  onChange,
  compact,
  contactsHidden,
}: {
  idPrefix: string;
  value: FamilyFields;
  onChange: (value: FamilyFields) => void;
  /** only the fields needed at admission */
  compact?: boolean;
  /** the viewer may not see phones/CNIC/address; those fields are not shown and keep their stored values */
  contactsHidden?: boolean;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const set = (key: keyof FamilyFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const contact = !contactsHidden;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id={id("father")} label="Father's name">
        <Input id={id("father")} maxLength={200} value={value.fatherName} onChange={set("fatherName")} />
      </Field>
      {contact && (
        <Field id={id("father-phone")} label="Father's mobile" hint="e.g. 0300 1234567">
          <Input id={id("father-phone")} inputMode="tel" maxLength={30} value={value.fatherPhone} onChange={set("fatherPhone")} />
        </Field>
      )}
      {contact && (
        <Field id={id("father-cnic")} label="Father's CNIC" hint="13 digits, dashes optional">
          <Input id={id("father-cnic")} maxLength={20} value={value.fatherCnic} onChange={set("fatherCnic")} />
        </Field>
      )}
      <Field id={id("father-job")} label="Father's profession">
        <Input id={id("father-job")} maxLength={100} value={value.fatherProfession} onChange={set("fatherProfession")} />
      </Field>
      <Field id={id("mother")} label="Mother's name">
        <Input id={id("mother")} maxLength={200} value={value.motherName} onChange={set("motherName")} />
      </Field>
      {contact && (
        <Field id={id("mother-phone")} label="Mother's mobile">
          <Input id={id("mother-phone")} inputMode="tel" maxLength={30} value={value.motherPhone} onChange={set("motherPhone")} />
        </Field>
      )}
      {contact && (
        <Field id={id("mother-cnic")} label="Mother's CNIC">
          <Input id={id("mother-cnic")} maxLength={20} value={value.motherCnic} onChange={set("motherCnic")} />
        </Field>
      )}
      {contact && (
        <Field id={id("email")} label="Email">
          <Input id={id("email")} type="email" maxLength={254} value={value.email} onChange={set("email")} />
        </Field>
      )}
      {contact && (
        <Field id={id("address")} label="Home address" className="sm:col-span-2">
          <Input id={id("address")} maxLength={500} value={value.address} onChange={set("address")} />
        </Field>
      )}
      {!compact && (
        <>
          {contact && (
            <>
              <Field id={id("em-name")} label="Emergency contact name">
                <Input id={id("em-name")} maxLength={200} value={value.emergencyName} onChange={set("emergencyName")} />
              </Field>
              <Field id={id("em-phone")} label="Emergency contact phone">
                <Input id={id("em-phone")} inputMode="tel" maxLength={30} value={value.emergencyPhone} onChange={set("emergencyPhone")} />
              </Field>
            </>
          )}
          <Field id={id("channel")} label="Messages by">
            <NativeSelect id={id("channel")} value={value.preferredChannel} onChange={set("preferredChannel")}>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="NONE">No messages</option>
            </NativeSelect>
          </Field>
          <Field id={id("remarks")} label="Remarks" className="sm:col-span-2">
            <Textarea id={id("remarks")} rows={2} maxLength={1000} value={value.remarks} onChange={set("remarks")} />
          </Field>
        </>
      )}
    </div>
  );
}
