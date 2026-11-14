import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { TestSheetPage } from "@/features/exams/test-marks-page";

export const metadata: Metadata = { title: "Test" };

/** One test's mark sheet: /app/marks/test?id=12. A fixed page, so it also opens offline. */
export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <TestSheetPage />
    </Suspense>
  );
}
