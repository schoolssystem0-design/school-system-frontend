"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Field } from "@/components/app/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/client";
import { meQueryKey, requestStepUp, verifyStepUp } from "@/lib/api/auth";

type Guard = <T>(action: () => Promise<T>) => Promise<T>;

const StepUpContext = createContext<Guard | null>(null);

/**
 * Sensitive actions (users, roles, rules) need a recent one-time code (FR 2.6). {@link useStepUp} wraps an action:
 * if the API answers STEP_UP_REQUIRED, a code is emailed, the dialog asks for it, and the action is retried.
 */
export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const sendCode = useCallback(async () => {
    setError(null);
    try {
      const sent = await requestStepUp();
      setSentTo(sent.sentTo ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const askForCode = useCallback(() => {
    setCode("");
    setSentTo(null);
    setOpen(true);
    void sendCode();
    return new Promise<void>((resolve, reject) => {
      pending.current = { resolve, reject };
    });
  }, [sendCode]);

  const guard = useCallback<Guard>(
    async (action) => {
      try {
        return await action();
      } catch (e) {
        if (e instanceof ApiError && e.code === "STEP_UP_REQUIRED") {
          await askForCode();
          return action();
        }
        throw e;
      }
    },
    [askForCode],
  );

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyStepUp(code.trim());
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      pending.current?.resolve();
      pending.current = null;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    setOpen(false);
    pending.current?.reject(new ApiError(403, "STEP_UP_CANCELLED", "Verification cancelled"));
    pending.current = null;
  }

  return (
    <StepUpContext.Provider value={guard}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
        <DialogContent>
          <form onSubmit={onVerify} className="contents">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" aria-hidden /> Confirm it&apos;s you
              </DialogTitle>
              <DialogDescription>
                {sentTo
                  ? `We sent a 6-digit code to ${sentTo}. It is valid for 5 minutes.`
                  : "Sending a verification code to your email…"}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field id="step-up-code" label="Verification code">
              <Input
                id="step-up-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => void sendCode()}>
                Send a new code
              </Button>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Checking…" : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </StepUpContext.Provider>
  );
}

export function useStepUp(): Guard {
  const guard = useContext(StepUpContext);
  if (!guard) throw new Error("useStepUp must be used inside StepUpProvider");
  return guard;
}
