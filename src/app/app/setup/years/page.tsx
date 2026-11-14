import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupWizardNav, SetupWizardSteps } from "@/features/setup/setup-wizard";
import { YearsPage } from "@/features/setup/years-page";

export const metadata: Metadata = { title: "Academic years" };

export default function YearsRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <SetupWizardSteps step="year" />
      </Suspense>
      <YearsPage />
      <Suspense fallback={null}>
        <SetupWizardNav step="year" />
      </Suspense>
    </>
  );
}
