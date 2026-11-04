"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, ChevronRight, Rocket, School, Sparkles } from "lucide-react";
import Link from "next/link";
import { DashboardPanels } from "@/features/dashboard/dashboard-page";
import { Card } from "@/components/ui/card";
import { academics, school } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { useMe } from "./app-shell";
import { useYear } from "./year-context";

/** The dashboard: the first-run setup checklist (FR 17 A) until set-up is done, then the panels (FR 3). */
export function Welcome() {
  const me = useMe();
  const { current } = useYear();
  const permissions = me.data?.permissions ?? [];
  const profile = useQuery({
    queryKey: ["school", "profile"],
    queryFn: school.profile,
    enabled: can(permissions, P.SCHOOL_PROFILE_VIEW),
  });
  const classes = useQuery({
    queryKey: ["academics", "classes"],
    queryFn: academics.classes,
    enabled: can(permissions, P.ACADEMICS_VIEW),
  });
  const subjects = useQuery({
    queryKey: ["academics", "subjects"],
    queryFn: academics.subjects,
    enabled: can(permissions, P.ACADEMICS_VIEW),
  });

  if (!me.data) return null;
  const steps = [
    {
      done: Boolean(profile.data?.phonePrimary && profile.data?.address),
      label: "Enter the school profile (address, phone, logo, signatures)",
      href: "/app/setup/school",
      show: can(permissions, P.SCHOOL_PROFILE_EDIT),
    },
    {
      done: Boolean(current),
      label: "Create and open the current academic year",
      href: "/app/setup/years",
      show: can(permissions, P.SCHOOL_YEAR_MANAGE),
    },
    {
      done: (classes.data?.length ?? 0) > 0,
      label: "Create classes and sections",
      href: "/app/setup/classes",
      show: can(permissions, P.ACADEMICS_MANAGE),
    },
    {
      done: (subjects.data?.length ?? 0) > 0,
      label: "Add subjects and maximum marks for each class",
      href: "/app/setup/subjects",
      show: can(permissions, P.ACADEMICS_MANAGE),
    },
    {
      done: false,
      label: "Create accounts for staff and give them roles",
      href: "/app/users",
      show: can(permissions, P.IAM_USER_MANAGE),
    },
  ].filter((s) => s.show);

  const showSetup = steps.some((s) => !s.done && s.href !== "/app/users");
  const doneCount = steps.filter((s) => s.done).length;
  const progress = steps.length === 0 ? 0 : Math.round((doneCount * 100) / steps.length);
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
          <span aria-hidden className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-primary shadow-xl shadow-primary/40 ring-1 ring-white/20 sm:flex">
            <School className="size-10" />
          </span>
        </div>
      </section>
      {showSetup && (
        <Card className="max-w-3xl gap-0 p-0">
          <div className="flex items-start gap-3 border-b p-4 sm:p-5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Set up your school</h2>
              <p className="text-sm text-muted-foreground">Complete these steps once; you can change everything later.</p>
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
                  href={step.href}
                  className={`flex-1 after:absolute after:inset-0 after:rounded-lg ${step.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium"}`}
                >
                  {step.label}
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
