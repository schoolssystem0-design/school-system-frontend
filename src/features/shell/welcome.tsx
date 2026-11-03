"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { DashboardPanels } from "@/features/dashboard/dashboard-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${me.data.displayName}`}
        description={`${me.data.school?.name}${current ? ` · Academic year ${current.name}` : ""}`}
      />
      {steps.some((s) => !s.done && s.href !== "/app/users") && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Set up your school</CardTitle>
            <CardDescription>Complete these steps once; you can change everything later.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {steps.map((step) => (
                <li key={step.href} className="flex items-center gap-2 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" aria-label="Done" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-label="To do" />
                  )}
                  <Link href={step.href} className="underline-offset-4 hover:underline">
                    {step.label}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      <DashboardPanels />
    </div>
  );
}
