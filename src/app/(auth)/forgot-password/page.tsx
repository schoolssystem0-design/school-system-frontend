import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/app/auth-card";
import { ForgotPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <AuthCard title="Forgot password" description="We will email you a link to choose a new password.">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
