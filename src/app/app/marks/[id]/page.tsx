import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { TestSheetPage } from "@/features/exams/test-marks-page";

export const metadata: Metadata = { title: "Test" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <TestSheetPage />
    </Suspense>
  );
}
