import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { ExamClassPage } from "@/features/exams/exam-class-page";

export const metadata: Metadata = { title: "Exam class" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <ExamClassPage />
    </Suspense>
  );
}
