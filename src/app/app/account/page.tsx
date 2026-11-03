import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "My account" };

export default function AccountRoute() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}
