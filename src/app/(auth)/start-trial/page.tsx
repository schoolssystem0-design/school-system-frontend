import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/app/auth-card";
import { TrialForm } from "@/features/auth/trial-form";

export const metadata: Metadata = { title: "Free trial" };

export default function Page() {
  return (
    <AuthCard title="Start your free trial" description="Set up your school in a minute and try everything.">
      <TrialForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground underline-offset-4 hover:underline">
          Already have a school code? Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
