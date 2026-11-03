"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { fetchMe, login, meQueryKey } from "@/lib/api/auth";
import {
  SCHOOL_CODE_STORAGE_KEY,
  type SignInErrors,
  safeNextPath,
  signInErrorMessage,
  validateSignIn,
} from "./sign-in-schema";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // School code: what the user typed, else the /s/<code> shortcut link, else the last school signed in to.
  const [typedSchoolCode, setSchoolCode] = useState<string | null>(null);
  const rememberedSchoolCode = useSyncExternalStore(
    subscribeToNothing,
    () => window.localStorage.getItem(SCHOOL_CODE_STORAGE_KEY),
    () => null,
  );
  const schoolCode = typedSchoolCode ?? searchParams.get("school") ?? rememberedSchoolCode ?? "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (me) => {
      window.localStorage.setItem(SCHOOL_CODE_STORAGE_KEY, me.school?.code ?? "");
      // Permissions are loaded per request, so fetch the full profile now (the login response has none).
      queryClient.removeQueries();
      await queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: fetchMe });
      router.replace(safeNextPath(searchParams.get("next")));
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSignIn({ schoolCode, username, password });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate(result.values);
  }

  const serverError =
    mutation.error instanceof ApiError
      ? signInErrorMessage(mutation.error.code)
      : mutation.error
        ? "Cannot reach the server. Check your connection and try again."
        : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Field id="schoolCode" label="School code" error={errors.schoolCode}>
        <Input
          id="schoolCode"
          name="schoolCode"
          autoComplete="organization"
          autoCapitalize="characters"
          value={schoolCode}
          onChange={(e) => setSchoolCode(e.target.value)}
          aria-invalid={!!errors.schoolCode}
          aria-describedby={errors.schoolCode ? "schoolCode-error" : undefined}
        />
      </Field>

      <Field id="username" label="Username" error={errors.username}>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? "username-error" : undefined}
        />
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
      </Field>

      <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2 w-full">
        {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {mutation.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

const subscribeToNothing = () => () => {};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
