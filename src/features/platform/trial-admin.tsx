"use client";

import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, CalendarPlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/client";
import { platform, type SchoolDetail } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

function daysLeft(endsAt: string, now: number) {
  return Math.ceil((new Date(endsAt).getTime() - now) / DAY);
}

/** "Trial · 9 days left" / "Trial ended" next to a school's status. Nothing for full (paid) access. */
export function TrialBadge({ endsAt }: { endsAt?: string | null }) {
  const [now] = useState(() => Date.now());
  if (!endsAt) return null;
  const left = daysLeft(endsAt, now);
  return left > 0 ? (
    <Badge variant="outline" className="ms-1 border-primary/40 text-primary">
      Trial · {left} {left === 1 ? "day" : "days"} left
    </Badge>
  ) : (
    <Badge variant="destructive" className="ms-1">
      Trial ended
    </Badge>
  );
}

/** For a school on its free trial: when it ends, and the owner's choices (activate or extend). */
export function TrialCard({ school, onChange }: { school: SchoolDetail; onChange: (s: SchoolDetail) => void }) {
  const [now] = useState(() => Date.now());
  const [days, setDays] = useState("14");
  const [confirming, setConfirming] = useState(false);
  const id = school.id ?? 0;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const activate = useMutation({
    mutationFn: () => platform.endTrial(id),
    onSuccess: (s) => {
      onChange(s);
      setConfirming(false);
      toast.success("Full access activated. The trial is over.");
    },
    onError,
  });
  const extend = useMutation({
    mutationFn: () => platform.extendTrial(id, Number(days)),
    onSuccess: (s) => {
      onChange(s);
      toast.success(`Trial extended until ${formatDate(s.trialEndsAt)}.`);
    },
    onError,
  });
  if (!school.trialEndsAt) return null;
  const left = daysLeft(school.trialEndsAt, now);
  return (
    <Card className={left > 0 ? "border-primary/30" : "border-destructive/40"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden /> Free trial
        </CardTitle>
        <CardDescription>
          {left > 0
            ? `Ends ${formatDate(school.trialEndsAt)} (${left} ${left === 1 ? "day" : "days"} left).`
            : `Ended ${formatDate(school.trialEndsAt)}. Its users cannot sign in; all its data is kept.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <Button onClick={() => setConfirming(true)} disabled={activate.isPending}>
          <BadgeCheck aria-hidden /> Activate full access
        </Button>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trial-days">Extend by (days)</Label>
            <Input id="trial-days" className="w-24" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <Button
            variant="outline"
            disabled={extend.isPending || !/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 90}
            onClick={() => extend.mutate()}
          >
            <CalendarPlus aria-hidden /> Extend trial
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Activate full access for ${school.name}?`}
        description="The free trial ends now and the school keeps using the system with no end date (for a school that has bought it)."
        confirmLabel="Activate full access"
        pending={activate.isPending}
        onConfirm={() => activate.mutate()}
      />
    </Card>
  );
}
