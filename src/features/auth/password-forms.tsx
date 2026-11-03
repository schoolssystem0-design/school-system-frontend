"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import {
  changePassword,
  completeSetup,
  confirmPasswordReset,
  meQueryKey,
  requestPasswordReset,
} from "@/lib/api/auth";
import { SCHOOL_CODE_STORAGE_KEY } from "./sign-in-schema";

const MIN = 10;

function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  const mismatch = confirm.length > 0 && password !== confirm;
  return (
    <>
      <Field id="new-password" label="New password" hint={`At least ${MIN} characters. A short phrase is easy to remember.`}>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} minLength={MIN}
          onChange={(e) => onPassword(e.target.value)} required />
      </Field>
      <Field id="confirm-password" label="Repeat new password" error={mismatch ? "The passwords do not match" : undefined}>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} aria-invalid={mismatch}
          onChange={(e) => onConfirm(e.target.value)} required />
      </Field>
    </>
  );
}

/** Signed-in user changes their own password (FR 2.2); forced after a temporary password. */
export function ChangePasswordForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const required = useSearchParams().get("required") === "1";
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const save = useMutation({
    mutationFn: () => changePassword(current, password),
    onSuccess: async () => {
      setDone(true);
      setCurrent("");
      setPassword("");
      setConfirm("");
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      if (required) router.replace("/app");
    },
  });
  return (
    <div className="flex max-w-md flex-col gap-4">
      <PageHeader title="My account" description="Change your password. Your other sessions are signed out." />
      {required && (
        <Alert>
          <AlertDescription>You signed in with a temporary password. Choose your own password to continue.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="pt-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(false);
              if (password === confirm) save.mutate();
            }}
          >
            {save.error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            )}
            {done && (
              <Alert role="status">
                <AlertDescription>Password changed.</AlertDescription>
              </Alert>
            )}
            <Field id="current-password" label="Current password">
              <Input id="current-password" type="password" autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Account setup link (new user / new school admin) and password reset link (FR 2.3). */
export function TokenPasswordForm({ mode }: { mode: "setup" | "reset" }) {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const save = useMutation({
    mutationFn: () => (mode === "setup" ? completeSetup(token, password) : confirmPasswordReset(token, password)),
  });
  if (save.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          <AlertDescription>
            {mode === "setup" ? "Your account is ready." : "Your password has been changed."} Sign in with your school
            code, username and new password.
          </AlertDescription>
        </Alert>
        <Button render={<Link href="/sign-in" />}>Go to sign in</Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (password === confirm) save.mutate();
      }}
    >
      {!token && (
        <Alert variant="destructive">
          <AlertDescription>This link is incomplete. Open the full link from your email.</AlertDescription>
        </Alert>
      )}
      {save.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      )}
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      <Button type="submit" disabled={save.isPending || !token}>
        {save.isPending ? "Saving…" : mode === "setup" ? "Set password" : "Change password"}
      </Button>
    </form>
  );
}

/** "Forgot password": always shows the same message so it never reveals which accounts exist. */
export function ForgotPasswordForm() {
  const [schoolCode, setSchoolCode] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(SCHOOL_CODE_STORAGE_KEY) ?? ""),
  );
  const [username, setUsername] = useState("");
  const send = useMutation({ mutationFn: () => requestPasswordReset(schoolCode.trim().toUpperCase(), username.trim()) });
  if (send.isSuccess) {
    return (
      <Alert role="status">
        <AlertDescription>
          If the account exists and has an email address, a reset link is on its way. It is valid for 30 minutes. If
          your account has no email, ask your school administrator to reset your password.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      {send.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(send.error)}</AlertDescription>
        </Alert>
      )}
      <Field id="fp-school" label="School code">
        <Input id="fp-school" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} required suppressHydrationWarning />
      </Field>
      <Field id="fp-username" label="Username">
        <Input id="fp-username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
      </Field>
      <Button type="submit" disabled={send.isPending}>
        {send.isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
