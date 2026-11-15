"use client";

import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Field } from "@/components/app/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/client";
import { platform } from "@/lib/api/endpoints";

/**
 * Super admin sign-in: email + password, then either a one-time code emailed to the user (default) or an authenticator
 * app when the API is configured for TOTP.
 */
export function PlatformSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secondStepCode, setSecondStepCode] = useState("");
  const [needEmailCode, setNeedEmailCode] = useState(false);
  const [codeSentHint, setCodeSentHint] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<{ secret: string; uri: string } | null>(null);

  const signIn = useMutation({
    mutationFn: () =>
      platform.login(email.trim(), password, {
        emailCode: needEmailCode ? secondStepCode.trim() : undefined,
        totpCode: !needEmailCode && secondStepCode ? secondStepCode.trim() : undefined,
      }),
    onSuccess: (result) => {
      if (result.status === "ENROL_TOTP") {
        setEnrolment({ secret: result.totpSecret ?? "", uri: result.otpauthUri ?? "" });
        setSecondStepCode("");
      } else {
        router.replace("/platform");
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "EMAIL_CODE_REQUIRED") {
        setNeedEmailCode(true);
        setCodeSentHint(err.message);
      }
    },
  });
  const enrol = useMutation({
    mutationFn: () => platform.enrol(secondStepCode.trim()),
    onSuccess: () => router.replace("/platform"),
  });
  const error =
    signIn.error instanceof ApiError &&
    (signIn.error.code === "EMAIL_CODE_REQUIRED" || signIn.error.code === "EMAIL_NOT_SENT")
      ? null
      : (signIn.error ?? enrol.error);

  if (enrolment) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          enrol.mutate();
        }}
      >
        <p className="text-sm">
          Set up two-step verification. Scan this code with an authenticator app (Google Authenticator, Microsoft
          Authenticator, 1Password…), then enter the 6-digit code it shows.
        </p>
        <QrImage value={enrolment.uri} />
        <p className="text-xs text-muted-foreground">
          Can&apos;t scan? Enter this key: <code className="break-all">{enrolment.secret}</code>
        </p>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        <Field id="enrol-code" label="Code from the app">
          <Input
            id="enrol-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={secondStepCode}
            onChange={(e) => setSecondStepCode(e.target.value.replace(/\D/g, ""))}
            required
          />
        </Field>
        <Button type="submit" disabled={enrol.isPending || secondStepCode.length !== 6}>
          {enrol.isPending ? "Checking…" : "Finish setup"}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        signIn.mutate();
      }}
    >
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <Field id="p-email" label="Email">
        <Input
          id="p-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus={!needEmailCode}
        />
      </Field>
      <Field id="p-password" label="Password">
        <Input
          id="p-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      {needEmailCode ? (
        <Field id="p-code" label="Sign-in code" hint={codeSentHint ?? "Check your email for the 6-digit code (10 minutes)."}>
          <Input
            id="p-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={secondStepCode}
            onChange={(e) => setSecondStepCode(e.target.value.replace(/\D/g, ""))}
            className="font-mono tracking-[0.3em]"
            autoFocus
          />
        </Field>
      ) : (
        <Field id="p-code" label="Authenticator code" hint="Only if your account uses an authenticator app">
          <Input
            id="p-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={secondStepCode}
            onChange={(e) => setSecondStepCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      )}
      <Button type="submit" disabled={signIn.isPending}>
        <ShieldCheck aria-hidden />{" "}
        {signIn.isPending ? "Signing in…" : needEmailCode ? "Verify and sign in" : "Sign in"}
      </Button>
    </form>
  );
}

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, { margin: 1, width: 200 }).then((url) => active && setSrc(url));
    return () => {
      active = false;
    };
  }, [value]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
    <img src={src} alt="QR code for the authenticator app" width={200} height={200} className="self-center rounded border" />
  ) : (
    <div className="h-[200px]" />
  );
}