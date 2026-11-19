import type { Metadata } from "next";
import { AuthCard } from "@/components/app/auth-card";
import { PlatformSignIn } from "@/features/platform/platform-sign-in";

export const metadata: Metadata = { title: "Platform sign in" };

export default function PlatformSignInRoute() {
  return (
    <AuthCard>
      <PlatformSignIn />
    </AuthCard>
  );
}
