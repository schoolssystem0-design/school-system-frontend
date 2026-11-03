"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage, fileUrl } from "@/lib/api/client";
import { school, type Profile } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";

type Signature = { role: string; name: string; title?: string; fileId?: number | null };

/** School profile and document identity (FR 1.1): printed on every voucher, receipt and report card. */
export function SchoolProfilePage() {
  const profile = useQuery({ queryKey: ["school", "profile"], queryFn: school.profile });
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  return <ProfileForm key={profile.data.version} initial={profile.data} />;
}

function ProfileForm({ initial }: { initial: Profile }) {
  const me = useMe();
  const editable = can(me.data?.permissions, P.SCHOOL_PROFILE_EDIT);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: initial.name ?? "",
    campusName: initial.campusName ?? "",
    address: initial.address ?? "",
    phonePrimary: initial.phonePrimary ?? "",
    phoneSecondary: initial.phoneSecondary ?? "",
    email: initial.email ?? "",
    headName: initial.headName ?? "",
    headTitle: initial.headTitle ?? "",
  });
  const [logoFileId, setLogo] = useState(initial.logoFileId ?? null);
  const [letterheadFileId, setLetterhead] = useState(initial.letterheadFileId ?? null);
  const [stampFileId, setStamp] = useState(initial.stampFileId ?? null);
  const [signatures, setSignatures] = useState<Signature[]>((initial.signatures as Signature[]) ?? []);

  const save = useMutation({
    mutationFn: () =>
      school.saveProfile({
        ...form,
        // Omitted IDs clear the image (the API treats a missing ID as "no file").
        logoFileId: logoFileId ?? undefined,
        letterheadFileId: letterheadFileId ?? undefined,
        stampFileId: stampFileId ?? undefined,
        signatures: signatures.map((s) => ({ ...s, title: s.title ?? "", fileId: s.fileId ?? undefined })),
        version: initial.version ?? 0,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["school", "profile"], saved);
      toast.success("School profile saved. New documents will use these details.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex max-w-3xl flex-col gap-6"
    >
      <PageHeader
        title="School profile"
        description="The school's identity, used on every printed document and on the website."
        actions={
          editable && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          )
        }
      />
      <fieldset disabled={!editable} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="School name">
              <Input id="name" value={form.name} onChange={set("name")} required maxLength={200} />
            </Field>
            <Field id="campusName" label="Campus">
              <Input id="campusName" value={form.campusName} onChange={set("campusName")} maxLength={200} />
            </Field>
            <Field id="address" label="Address" className="sm:col-span-2">
              <Input id="address" value={form.address} onChange={set("address")} maxLength={500} />
            </Field>
            <Field id="phonePrimary" label="Main phone">
              <Input id="phonePrimary" value={form.phonePrimary} onChange={set("phonePrimary")} maxLength={30} />
            </Field>
            <Field id="phoneSecondary" label="Second phone">
              <Input id="phoneSecondary" value={form.phoneSecondary} onChange={set("phoneSecondary")} maxLength={30} />
            </Field>
            <Field id="email" label="Office email">
              <Input id="email" type="email" value={form.email} onChange={set("email")} maxLength={254} />
            </Field>
            <div />
            <Field id="headName" label="Head of school">
              <Input id="headName" value={form.headName} onChange={set("headName")} maxLength={200} />
            </Field>
            <Field id="headTitle" label="Title">
              <Input id="headTitle" value={form.headTitle} onChange={set("headTitle")} placeholder="Principal" maxLength={100} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document identity</CardTitle>
            <CardDescription>PNG, JPEG or WebP up to 5 MB.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <ImageUpload label="Logo" purpose="SCHOOL_LOGO" fileId={logoFileId} onChange={setLogo} />
            <ImageUpload label="Letterhead" purpose="SCHOOL_LETTERHEAD" fileId={letterheadFileId} onChange={setLetterhead} />
            <ImageUpload label="School stamp" purpose="SCHOOL_STAMP" fileId={stampFileId} onChange={setStamp} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authorised signatures</CardTitle>
            <CardDescription>Printed on report cards, certificates and vouchers according to the rules.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {signatures.map((sig, i) => (
              <div key={i} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
                <Field id={`sig-role-${i}`} label="Used as">
                  <Input
                    id={`sig-role-${i}`}
                    value={sig.role}
                    placeholder="Principal"
                    onChange={(e) => setSignatures((all) => all.map((s, j) => (j === i ? { ...s, role: e.target.value } : s)))}
                  />
                </Field>
                <Field id={`sig-name-${i}`} label="Name">
                  <Input
                    id={`sig-name-${i}`}
                    value={sig.name}
                    onChange={(e) => setSignatures((all) => all.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))}
                  />
                </Field>
                <Field id={`sig-title-${i}`} label="Title">
                  <Input
                    id={`sig-title-${i}`}
                    value={sig.title ?? ""}
                    onChange={(e) => setSignatures((all) => all.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
                  />
                </Field>
                <ImageUpload
                  compact
                  label="Signature image"
                  purpose="SIGNATURE"
                  fileId={sig.fileId ?? null}
                  onChange={(fileId) => setSignatures((all) => all.map((s, j) => (j === i ? { ...s, fileId } : s)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove signature ${sig.name || i + 1}`}
                  onClick={() => setSignatures((all) => all.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {editable && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => setSignatures((all) => [...all, { role: "", name: "", title: "" }])}
              >
                <Plus aria-hidden /> Add signature
              </Button>
            )}
          </CardContent>
        </Card>
      </fieldset>
    </form>
  );
}

function ImageUpload({
  label,
  purpose,
  fileId,
  onChange,
  compact,
}: {
  label: string;
  purpose: string;
  fileId: number | null;
  onChange: (id: number | null) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const src = fileUrl(fileId);
  const inputId = `upload-${purpose}-${label.replace(/\s/g, "")}-${Math.abs(fileId ?? 0)}`;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {!compact && (
        <div className="flex h-24 items-center justify-center rounded-lg border bg-muted/40">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not optimisable
            <img src={src} alt={`${label} preview`} className="max-h-20 max-w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted"
        >
          <Upload className="size-4" aria-hidden /> {busy ? "Uploading…" : src ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const saved = await school.upload(purpose, file);
              onChange(saved.id ?? null);
              toast.success(`${label} uploaded. Save to apply.`);
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
        {src && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
