import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupWizardNav, SetupWizardSteps } from "@/features/setup/setup-wizard";
import { SchoolProfilePage } from "@/features/setup/school-profile-page";

export const metadata: Metadata = { title: "School profile" };

export default function SchoolProfileRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <SetupWizardSteps step="school" />
      </Suspense>
      <SchoolProfilePage />
      <Suspense fallback={null}>
        <SetupWizardNav step="school" />
      </Suspense>
    </>
  );
}
