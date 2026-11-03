import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { TokenPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense>
        <TokenPasswordForm mode="reset" />
      </Suspense>
    </AuthCard>
  );
}
