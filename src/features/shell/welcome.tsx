"use client";

import { ArrowRight, CalendarRange, Check, ChevronRight, Rocket, School, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DashboardPanels } from "@/features/dashboard/dashboard-page";
import { SetupFinished, useSetupSteps, wizardHref } from "@/features/setup/setup-wizard";
import { SchoolLogo } from "@/components/app/avatars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMe } from "./app-shell";
import { useYear } from "./year-context";

/** The dashboard: the first-run setup checklist (FR 17 A) until set-up is done, then the panels (FR 3). */
export function Welcome() {
  const me = useMe();
  const { current } = useYear();
  const { steps, checking, remaining } = useSetupSteps();
  // Just finished the wizard (perhaps skipping optional steps): show the "ready" card, not the checklist
  const finished = useSearchParams().get("setup") === "done";

  if (!me.data) return null;
  const showSetup = !checking && !finished && remaining.length > 0;
  const doneCount = steps.filter((s) => s.done).length;
  const progress = steps.length === 0 ? 0 : Math.round((doneCount * 100) / steps.length);
  const nextStep = remaining[0];
  const nextIndex = nextStep ? steps.indexOf(nextStep) : -1;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-2xl bg-navy px-5 py-6 text-white shadow-lg shadow-navy/20 sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 -z-10 size-72 rounded-full bg-primary/50 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:18px_18px]"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span aria-hidden className="mb-3 block h-1 w-10 rounded-full bg-highlight" />
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Sparkles className="size-4 text-highlight" aria-hidden /> {greeting} · {today}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">Welcome, {me.data.displayName}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
                <School className="size-3.5" aria-hidden /> {me.data.school?.name}
              </span>
              {current && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
                  <CalendarRange className="size-3.5" aria-hidden /> Academic year {current.name}
                </span>
              )}
            </div>
          </div>
          <SchoolLogo
            logoFileId={me.data.school?.logoFileId}
            className="hidden size-20 rounded-3xl shadow-xl shadow-primary/30 sm:flex"
            iconClassName="size-10"
          />
        </div>
      </section>
      <Suspense fallback={null}>
        <SetupFinished />
      </Suspense>
      {showSetup && nextStep && (
        <Card className="max-w-3xl gap-0 p-0">
          <div className="flex items-start gap-3 border-b p-4 sm:p-5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Set up your school</h2>
              <p className="text-sm text-muted-foreground">
                A few guided steps, one after another. You can change everything later.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label="Set-up progress"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {doneCount}/{steps.length}
                </span>
              </div>
              <Button className="mt-4" render={<Link href={wizardHref(nextStep.href)} />}>
                {doneCount === 0 ? "Start set-up" : `Continue set-up (step ${nextIndex + 1} of ${steps.length})`}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
          <ol className="flex flex-col p-2">
            {steps.map((step, i) => (
              <li key={step.href} className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted">
                {step.done ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" role="img" aria-label="Done">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                ) : (
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-[11px] font-semibold text-muted-foreground"
                    role="img"
                    aria-label="To do"
                  >
                    <span aria-hidden>{i + 1}</span>
                  </span>
                )}
                <Link
                  href={wizardHref(step.href)}
                  className={`flex-1 after:absolute after:inset-0 after:rounded-lg ${step.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium"}`}
                >
                  {step.label}
                  {step.optional && !step.done && <span className="ms-1.5 text-xs font-normal text-muted-foreground">(optional)</span>}
                </Link>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </li>
            ))}
          </ol>
        </Card>
      )}
      <DashboardPanels />
    </div>
  );
}
