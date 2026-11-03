import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { MarksPage } from "@/features/exams/marks-page";

export const metadata: Metadata = { title: "Enter marks" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <MarksPage />
    </Suspense>
  );
}
