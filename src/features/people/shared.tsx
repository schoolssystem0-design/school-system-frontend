"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { errorMessage } from "@/lib/api/client";
import { academics, school, type SchoolClass } from "@/lib/api/endpoints";
import { can, type Permission } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";

/** True when the signed-in user holds the permission (UI only; the API enforces it). */
export function useCan() {
  const me = useMe();
  return (permission: Permission) => can(me.data?.permissions, permission);
}

export function useClasses() {
  return useQuery({
    queryKey: ["academics", "classes"],
    queryFn: academics.classes,
  });
}

/** Active sections as "Class 5 - A" options, in class order. */
export function sectionOptions(classes: SchoolClass[] | undefined) {
  return (classes ?? [])
    .filter((c) => c.status === "ACTIVE")
    .flatMap((c) =>
      (c.sections ?? [])
        .filter((s) => s.status === "ACTIVE")
        .map((s) => ({
          id: s.id ?? 0,
          classId: c.id ?? 0,
          label: `${c.name} - ${s.name}`,
        })),
    );
}

export function SectionSelect({
  id,
  value,
  onChange,
  emptyLabel = "Choose a section",
  required,
  className,
  classId,
}: {
  id: string;
  value: number | "";
  onChange: (value: number | "") => void;
  emptyLabel?: string;
  required?: boolean;
  className?: string;
  /** only sections of this class */
  classId?: number | "";
}) {
  const classes = useClasses();
  return (
    <NativeSelect
      id={id}
      className={className}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{emptyLabel}</option>
      {sectionOptions(classes.data)
        .filter((s) => !classId || s.classId === classId)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
    </NativeSelect>
  );
}

export function ClassSelect({
  id,
  value,
  onChange,
  emptyLabel = "All classes",
  className,
}: {
  id: string;
  value: number | "";
  onChange: (value: number | "") => void;
  emptyLabel?: string;
  className?: string;
}) {
  const classes = useClasses();
  return (
    <NativeSelect
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{emptyLabel}</option>
      {(classes.data ?? [])
        .filter((c) => c.status === "ACTIVE")
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </NativeSelect>
  );
}

/** A small file picker that uploads straight away and reports the stored file id. */
export function UploadButton({
  purpose,
  accept,
  label,
  onUploaded,
  disabled,
}: {
  purpose: "PHOTO" | "STUDENT_DOCUMENT" | "STAFF_DOCUMENT" | "ACCOUNT_DOCUMENT";
  accept: string;
  label: string;
  onUploaded: (fileId: number, fileName: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const info = await school.upload(purpose, file);
            onUploaded(info.id ?? 0, file.name);
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number | undefined;
  onChange: (page: number) => void;
}) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      Page {page + 1} of {totalPages}
      <Button
        size="sm"
        variant="outline"
        disabled={page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

/** Today's date in Pakistan as yyyy-mm-dd, for date inputs. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );
}

/** Turns "" into undefined so optional fields are omitted from requests. */
export function opt<T extends string>(value: T | ""): T | undefined {
  return value === "" ? undefined : value;
}

export const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}
