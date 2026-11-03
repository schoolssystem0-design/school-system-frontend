import type { Metadata } from "next";
import { TestMarksPage } from "@/features/exams/test-marks-page";

export const metadata: Metadata = { title: "Test marks" };

export default function Route() {
  return <TestMarksPage />;
}
