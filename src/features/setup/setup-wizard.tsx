"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { academics, school } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useMe } from "@/features/shell/app-shell";
import { useYear } from "@/features/shell/year-context";

export type SetupStepKey = "school" | "year" | "classes" | "subjects" | "users";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  short: string;
  href: string;
  done: boolean;
  /** Can be skipped in the wizard (the school works without it). */
  optional: boolean;
  /** One save completes it, so the wizard moves on by itself; otherwise the user adds several and presses Next. */
  autoAdvance: boolean;
  /** What is still needed before Next, when the step is required and not done. */
  needs: string;
};

/** Marks a link or path as opened from the set-up wizard. */
export const wizardHref = (href: string) => `${href}?setup=1`;

/**
 * The first-run set-up steps the signed-in user may do, whether each is done, and whether the checks are still
 * loading (FR 17 A). Shared by the dashboard card and the wizard.
 */
export function useSetupSteps() {
  const me = useMe();
  const { current, isLoading: yearsLoading } = useYear();
  const permissions = me.data?.permissions ?? [];
  const canProfile = can(permissions, P.SCHOOL_PROFILE_VIEW);
  const canAcademics = can(permissions, P.ACADEMICS_VIEW);
  const profile = useQuery({ queryKey: ["school", "profile"], queryFn: school.profile, enabled: canProfile });
  const classes = useQuery({ queryKey: ["academics", "classes"], queryFn: academics.classes, enabled: canAcademics });
  const subjects = useQuery({ queryKey: ["academics", "subjects"], queryFn: academics.subjects, enabled: canAcademics });

  const all: (SetupStep & { show: boolean })[] = [
    {
      key: "school",
      label: "Enter the school profile (address, phone, logo, signatures)",
      short: "School profile",
      href: "/app/setup/school",
      done: Boolean(profile.data?.phonePrimary && profile.data?.address),
      optional: false,
      autoAdvance: true,
      needs: "Enter the address and phone number, then save.",
      show: can(permissions, P.SCHOOL_PROFILE_EDIT),
    },
    {
      key: "year",
      label: "Create and open the current academic year",
      short: "Academic year",
      href: "/app/setup/years",
      done: Boolean(current),
      optional: false,
      autoAdvance: true,
      needs: "Create the academic year and open it as the current year.",
      show: can(permissions, P.SCHOOL_YEAR_MANAGE),
    },
    {
      key: "classes",
      label: "Create classes and sections",
      short: "Classes & sections",
      href: "/app/setup/classes",
      done: (classes.data?.length ?? 0) > 0,
      optional: false,
      autoAdvance: false,
      needs: "Add at least one class with its sections.",
      show: can(permissions, P.ACADEMICS_MANAGE),
    },
    {
      key: "subjects",
      label: "Add subjects and maximum marks for each class",
      short: "Subjects & marks",
      href: "/app/setup/subjects",
      done: (subjects.data?.length ?? 0) > 0,
      optional: true,
      autoAdvance: false,
      needs: "",
      show: can(permissions, P.ACADEMICS_MANAGE),
    },
    {
      key: "users",
      label: "Create accounts for staff and give them roles",
      short: "Staff accounts",
      href: "/app/users",
      done: false,
      optional: true,
      autoAdvance: false,
      needs: "",
      show: can(permissions, P.IAM_USER_MANAGE),
    },
  ];
  const steps = all.filter((s) => s.show);
  // While the checks load every step looks "not done": decide only once they have answered.
  const checking =
    !me.data ||
    yearsLoading ||
    (canProfile && profile.isPending) ||
    (canAcademics && (classes.isPending || subjects.isPending));
  /** Required steps (and subjects) still to do; staff accounts never keep the card open. */
  const remaining = steps.filter((s) => !s.done && s.key !== "users");
  return { steps, checking, remaining };
}

function useWizardStep(step: SetupStepKey) {
  const params = useSearchParams();
  const active = params.get("setup") === "1";
  const { steps, checking } = useSetupSteps();
  const index = steps.findIndex((s) => s.key === step);
  return { active: active && index >= 0, steps, checking, index, current: steps[index] };
}

/** Top of a set-up page opened from the wizard: which step this is, and every step with its state. */
export function SetupWizardSteps({ step }: { step: SetupStepKey }) {
  const { active, steps, index, current } = useWizardStep(step);
  if (!active || !current) return null;
  return (
    <Card className="mb-5 gap-3 p-4 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          Set up your school <span className="font-normal text-muted-foreground">· Step {index + 1} of {steps.length}</span>
        </p>
        <Link href="/app" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Finish later
        </Link>
      </div>
      <ol className="flex gap-1.5" aria-label="Set-up steps">
        {steps.map((s, i) => (
          <li key={s.key} className="min-w-0 flex-1">
            <Link
              href={wizardHref(s.href)}
              aria-current={i === index ? "step" : undefined}
              className="group flex flex-col gap-1.5 rounded-md outline-offset-2"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  i === index ? "bg-primary" : s.done ? "bg-emerald-600" : "bg-muted group-hover:bg-muted-foreground/30",
                )}
              />
              <span
                className={cn(
                  "hidden items-center gap-1 truncate text-xs sm:flex",
                  i === index ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s.done && <Check className="size-3 shrink-0 text-emerald-600" aria-label="Done" />}
                {s.short}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium sm:hidden">{current.short}</p>
    </Card>
  );
}

/**
 * Bottom of a set-up page opened from the wizard: Back, Next (or Skip / Finish). A step that one save completes
 * (profile, academic year) moves on by itself as soon as it becomes done.
 */
export function SetupWizardNav({ step }: { step: SetupStepKey }) {
  const router = useRouter();
  const { active, steps, checking, index, current } = useWizardStep(step);
  const wasDone = useRef<boolean | null>(null);
  const prev = index > 0 ? steps[index - 1] : undefined;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : undefined;
  const done = current?.done ?? false;

  useEffect(() => {
    if (!active || checking || !current) return;
    // Remember the state when the page opened; move on only when it changes from not done to done here.
    if (wasDone.current === null) {
      wasDone.current = done;
      return;
    }
    if (!wasDone.current && done && current.autoAdvance) {
      wasDone.current = true;
      toast.success(`${current.short} saved.${next ? ` Next: ${next.short}` : ""}`);
      const t = setTimeout(() => router.push(next ? wizardHref(next.href) : "/app?setup=done"), 900);
      return () => clearTimeout(t);
    }
    wasDone.current = done;
  }, [active, checking, current, done, next, router]);

  if (!active || !current) return null;
  const blocked = !done && !current.optional;
  const finish = () => router.push("/app?setup=done");
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {prev ? (
          <Button variant="outline" render={<Link href={wizardHref(prev.href)} />}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        {blocked && <p className="order-last w-full text-sm text-muted-foreground sm:order-none sm:w-auto">{current.needs}</p>}
        <div className="flex gap-2">
          {current.optional && !done && (
            <Button variant="ghost" onClick={() => (next ? router.push(wizardHref(next.href)) : finish())}>
              Skip for now
            </Button>
          )}
          {next ? (
            <Button disabled={blocked || checking} onClick={() => router.push(wizardHref(next.href))}>
              Next: {next.short} <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button disabled={blocked || checking} onClick={finish}>
              Finish set-up <Check aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** On the dashboard after the wizard's last step. */
export function SetupFinished() {
  const params = useSearchParams();
  const me = useMe();
  if (params.get("setup") !== "done") return null;
  const permissions = me.data?.permissions ?? [];
  const links = [
    { href: "/app/students/new", label: "Admit students", show: can(permissions, P.STUDENTS_MANAGE) },
    { href: "/app/attendance", label: "Take attendance", show: can(permissions, P.ATTENDANCE_MARK) },
    { href: "/app/fees/setup", label: "Set up fees", show: can(permissions, P.FEES_SETUP) },
  ].filter((l) => l.show);
  return (
    <Card className="max-w-3xl flex-row flex-wrap items-center gap-4 border-emerald-600/30 bg-emerald-50 p-4 sm:p-5 dark:bg-emerald-950/30">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
        <PartyPopper className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">Your school is ready</h2>
        <p className="text-sm text-muted-foreground">Everything can be changed later under Set-up. What would you like to do first?</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Button key={l.href} variant="outline" size="sm" render={<Link href={l.href} />}>
            {l.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
