import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { TokenPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Set up your account" };

export default function Page() {
  return (
    <AuthCard title="Set up your account" description="Choose the password for your new account.">
      <Suspense>
        <TokenPasswordForm mode="setup" />
      </Suspense>
    </AuthCard>
  );
}
