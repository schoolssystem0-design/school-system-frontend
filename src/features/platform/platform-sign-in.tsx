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
 * Super admin sign-in: email + password, then a one-time code from email (default). Authenticator appears only when the
 * API is in TOTP mode.
 */
export function PlatformSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secondStepCode, setSecondStepCode] = useState("");
  /** After password is accepted: email code (default) or authenticator when the API asks for TOTP. */
  const [secondStep, setSecondStep] = useState<"email" | "totp" | null>(null);
  const [codeSentHint, setCodeSentHint] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<{ secret: string; uri: string } | null>(null);

  const signIn = useMutation({
    mutationFn: () =>
      platform.login(email.trim(), password, {
        emailCode: secondStep === "email" ? secondStepCode.trim() : undefined,
        totpCode: secondStep === "totp" ? secondStepCode.trim() : undefined,
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
        setSecondStep("email");
        setSecondStepCode("");
        setCodeSentHint(err.message);
      } else if (err instanceof ApiError && err.code === "TOTP_REQUIRED") {
        setSecondStep("totp");
        setSecondStepCode("");
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
          autoFocus={secondStep === null}
          readOnly={secondStep !== null}
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
          readOnly={secondStep !== null}
        />
      </Field>
      {secondStep === "email" && (
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
      )}
      {secondStep === "totp" && (
        <Field id="p-code" label="Authenticator code" hint="Enter the 6-digit code from your authenticator app.">
          <Input
            id="p-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={secondStepCode}
            onChange={(e) => setSecondStepCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </Field>
      )}
      {secondStep === "email" && signIn.error instanceof ApiError && signIn.error.code === "EMAIL_NOT_SENT" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{signIn.error.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={signIn.isPending}>
        <ShieldCheck aria-hidden />{" "}
        {signIn.isPending ? "Signing in…" : secondStep ? "Verify and sign in" : "Sign in"}
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