import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { PlatformShell } from "@/features/platform/platform-shell";

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  // The shell reads the URL (active menu item), which is only known at request time on dynamic routes.
  return (
    <Suspense fallback={<Loading />}>
      <PlatformShell>{children}</PlatformShell>
    </Suspense>
  );
}
