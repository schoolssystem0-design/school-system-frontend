"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";

/**
 * Confirmation for consequential actions. With {@code requireReason} the user must give a reason, which is stored in
 * the activity history (FR 2.4, 12.2).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  requireReason,
  requireMatch,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  requireReason?: boolean;
  /** User must type this text exactly (case-insensitive) before confirming. */
  requireMatch?: { label: string; expected: string };
  pending?: boolean;
  onConfirm: (reason: string, typedMatch?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [match, setMatch] = useState("");
  const [touched, setTouched] = useState(false);
  const missingReason = requireReason && reason.trim().length === 0;
  const missingMatch =
    requireMatch != null && match.trim().toUpperCase() !== requireMatch.expected.trim().toUpperCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setMatch("");
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!missingReason && !missingMatch) {
              onConfirm(reason.trim(), requireMatch ? match.trim() : undefined);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {requireMatch && (
            <Field
              id="confirm-match"
              label={requireMatch.label}
              error={touched && missingMatch ? `Type ${requireMatch.expected} to confirm` : undefined}
            >
              <Input
                id="confirm-match"
                value={match}
                onChange={(e) => setMatch(e.target.value)}
                autoComplete="off"
                aria-invalid={touched && missingMatch}
              />
            </Field>
          )}
          {requireReason && (
            <Field id="confirm-reason" label="Reason" error={touched && missingReason ? "Give a reason" : undefined}>
              <Textarea
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                aria-invalid={touched && missingReason}
              />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || missingReason || missingMatch}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
