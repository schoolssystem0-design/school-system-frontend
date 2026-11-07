"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { platform } from "@/lib/api/endpoints";

/**
 * The server's email set-up (verification codes, password resets, setup links) for the system owner: what is
 * configured, what is wrong, and a test email that reports the exact reason when it fails.
 */
export function EmailCheck() {
  const status = useQuery({ queryKey: ["platform", "email"], queryFn: platform.emailStatus });
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ sent: boolean; error?: string } | null>(null);
  const test = useMutation({
    mutationFn: () => platform.emailTest(to.trim()),
    onSuccess: (r) => {
      setResult({ sent: Boolean(r.sent), error: r.error ?? undefined });
      if (r.sent) toast.success(`Test email sent to ${to.trim()}. Check the inbox (and spam).`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (status.isPending || status.isError) return null;
  const s = status.data;
  const problems = s.problems ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Email for verification codes and links
            {s.ready ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" aria-hidden /> Set up
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300">
                <AlertTriangle className="size-3" aria-hidden /> Needs attention
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Schools need it to add users and change settings (verification codes), and for password resets and setup links.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Sent through</dt>
            <dd className="truncate font-medium">{s.service ?? "Nothing set up"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">From</dt>
            <dd className="truncate font-medium">{s.from ? `${s.fromName} <${s.from}>` : "Not set"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Links in emails open</dt>
            <dd className="truncate font-medium">{s.webBaseUrl || "Not set"}</dd>
          </div>
        </dl>
        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>Fix on the server (environment variables), then restart it</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc ps-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            test.mutate();
          }}
        >
          <Field id="email-test" label="Send a test email to" className="flex-1">
            <Input id="email-test" type="email" autoComplete="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" disabled={!to.trim() || test.isPending}>
            <Send aria-hidden /> {test.isPending ? "Sending…" : "Send test email"}
          </Button>
        </form>
        {result && !result.sent && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>The test email was not sent</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
