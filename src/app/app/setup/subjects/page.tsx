import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupWizardNav, SetupWizardSteps } from "@/features/setup/setup-wizard";
import { SubjectsPage } from "@/features/setup/subjects-page";

export const metadata: Metadata = { title: "Subjects & marks" };

export default function SubjectsRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <SetupWizardSteps step="subjects" />
      </Suspense>
      <SubjectsPage />
      <Suspense fallback={null}>
        <SetupWizardNav step="subjects" />
      </Suspense>
    </>
  );
}
