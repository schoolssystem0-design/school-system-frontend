import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo, PoweredBy } from "@/components/app/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <BrandLogo className="h-12 sm:h-14" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">Sign in</h1>
          </CardTitle>
          <CardDescription>Use the school code given by your administrator.</CardDescription>
          {/* <CardDescription>Use the school code given by your administrator.</CardDescription> */}
        </CardHeader>
        <CardContent>
          <Suspense>
            <SignInForm />
          </Suspense>
          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p className="mt-3 border-t pt-4 text-center text-sm text-muted-foreground">
            New school?{" "}
            <Link href="/start-trial" className="font-medium text-primary underline-offset-4 hover:underline">
              Start a free 14-day trial
            </Link>
          </p>
        </CardContent>
      </Card>
      <PoweredBy />
    </main>
  );
}
