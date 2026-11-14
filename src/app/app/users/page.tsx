import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupWizardNav, SetupWizardSteps } from "@/features/setup/setup-wizard";
import { UsersPage } from "@/features/iam/users-page";

export const metadata: Metadata = { title: "Users" };

export default function UsersRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <SetupWizardSteps step="users" />
      </Suspense>
      <UsersPage />
      <Suspense fallback={null}>
        <SetupWizardNav step="users" />
      </Suspense>
    </>
  );
}
