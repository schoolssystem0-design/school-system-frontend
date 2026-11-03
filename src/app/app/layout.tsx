import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { AppShell } from "@/features/shell/app-shell";

export default function SchoolPortalLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<Loading />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
