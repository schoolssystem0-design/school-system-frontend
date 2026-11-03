import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { ExamDetail } from "@/features/exams/exam-detail";

export const metadata: Metadata = { title: "Exam" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <ExamDetail />
    </Suspense>
  );
}
