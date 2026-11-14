"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/client";
import { trial } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/format";

const EMPTY = { schoolName: "", schoolCode: "", adminName: "", username: "", email: "", website: "" };

/** A short code from the school's name: "Green Valley School" → "GVS". */
function suggestCode(name: string) {
  const letters = name
    .split(/\s+/)
    .filter((w) => w && !/^(the|of|and|&)$/i.test(w))
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return letters.length >= 2 ? letters.slice(0, 10) : "";
}

/** Free trial sign-up (public): a new school with every feature for 14 days. */
export function TrialForm() {
  const info = useQuery({ queryKey: ["public", "trial"], queryFn: trial.info, retry: false });
  const days = info.data?.days ?? 14;
  const [form, setForm] = useState(EMPTY);
  const [codeTouched, setCodeTouched] = useState(false);
  const start = useMutation({ mutationFn: () => trial.start({ ...form, schoolCode: form.schoolCode.trim().toUpperCase() }) });
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      [key]: key === "schoolCode" ? value.toUpperCase() : value,
      ...(key === "schoolName" && !codeTouched ? { schoolCode: suggestCode(value) } : {}),
    }));
    if (key === "schoolCode") setCodeTouched(true);
  };

  if (start.data) {
    const done = start.data;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Check your email</p>
            <p className="text-muted-foreground">
              We sent a link to <strong className="text-foreground">{done.email}</strong> to choose your password. It works
              for 48 hours.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border p-4 text-sm">
          <dt className="text-muted-foreground">School code</dt>
          <dd className="font-semibold tracking-wide">{done.schoolCode}</dd>
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-semibold">{done.username}</dd>
          <dt className="text-muted-foreground">Free until</dt>
          <dd className="font-semibold">{formatDate(done.trialEndsAt)}</dd>
        </dl>
        <p className="text-sm text-muted-foreground">Write these down: you sign in with the school code and username.</p>
        <Button render={<Link href={`/sign-in?school=${encodeURIComponent(done.schoolCode ?? "")}`} />} size="lg">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start.mutate();
      }}
    >
      <ul className="flex flex-col gap-1.5 text-sm">
        {[`Every feature, free for ${days} days`, "No payment details needed", "Your data is kept when the trial ends"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      {start.error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{errorMessage(start.error)}</AlertDescription>
        </Alert>
      )}
      <TrialField id="tr-name" label="School name">
        <Input id="tr-name" required maxLength={200} autoComplete="organization" value={form.schoolName} onChange={set("schoolName")} />
      </TrialField>
      <TrialField id="tr-code" label="School code" hint="2-20 letters or numbers, e.g. GVS. Everyone types it to sign in.">
        <Input id="tr-code" required maxLength={20} autoCapitalize="characters" value={form.schoolCode} onChange={set("schoolCode")} />
      </TrialField>
      <TrialField id="tr-admin" label="Your name">
        <Input id="tr-admin" required maxLength={200} autoComplete="name" value={form.adminName} onChange={set("adminName")} />
      </TrialField>
      <TrialField id="tr-user" label="Choose a username">
        <Input id="tr-user" required maxLength={60} autoComplete="username" value={form.username} onChange={set("username")} />
      </TrialField>
      <TrialField id="tr-email" label="Your email" hint="We send the link to choose your password here.">
        <Input id="tr-email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={set("email")} />
      </TrialField>
      {/* Hidden from people; bots fill it in */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="tr-website">Website</label>
        <input id="tr-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Button type="submit" size="lg" disabled={start.isPending} className="mt-1 w-full">
        {start.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {start.isPending ? "Creating your school…" : `Start ${days}-day free trial`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">One free trial per school and internet connection.</p>
    </form>
  );
}

function TrialField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
