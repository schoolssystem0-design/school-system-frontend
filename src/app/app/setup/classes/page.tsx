import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupWizardNav, SetupWizardSteps } from "@/features/setup/setup-wizard";
import { ClassesPage } from "@/features/setup/classes-page";

export const metadata: Metadata = { title: "Classes & sections" };

export default function ClassesRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <SetupWizardSteps step="classes" />
      </Suspense>
      <ClassesPage />
      <Suspense fallback={null}>
        <SetupWizardNav step="classes" />
      </Suspense>
    </>
  );
}
