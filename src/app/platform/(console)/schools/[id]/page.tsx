import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { SchoolDetailPage } from "@/features/platform/platform-pages";

export const metadata: Metadata = { title: "School" };

export default function SchoolDetailRoute() {
  return (
    <Suspense fallback={<Loading />}>
      <SchoolDetailPage />
    </Suspense>
  );
}
