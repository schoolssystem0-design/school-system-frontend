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
import { errorMessage } from "@/lib/api/client";
import { platform } from "@/lib/api/endpoints";

/**
 * Super admin sign-in: email + password + authenticator code (mandatory). On first sign-in the authenticator app is
 * set up by scanning a QR code.
 */
export function PlatformSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrolment, setEnrolment] = useState<{ secret: string; uri: string } | null>(null);

  const signIn = useMutation({
    mutationFn: () => platform.login(email.trim(), password, code.trim()),
    onSuccess: (result) => {
      if (result.status === "ENROL_TOTP") {
        setEnrolment({ secret: result.totpSecret ?? "", uri: result.otpauthUri ?? "" });
        setCode("");
      } else {
        router.replace("/platform");
      }
    },
  });
  const enrol = useMutation({
    mutationFn: () => platform.enrol(code.trim()),
    onSuccess: () => router.replace("/platform"),
  });
  const error = signIn.error ?? enrol.error;

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
          <Input id="enrol-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
        </Field>
        <Button type="submit" disabled={enrol.isPending || code.length !== 6}>
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
        <Input id="p-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field id="p-password" label="Password">
        <Input id="p-password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field id="p-code" label="Authenticator code" hint="Leave empty on your very first sign-in">
        <Input id="p-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Button type="submit" disabled={signIn.isPending}>
        <ShieldCheck aria-hidden /> {signIn.isPending ? "Signing in…" : "Sign in"}
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
