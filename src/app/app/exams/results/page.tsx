import type { Metadata } from "next";
import { ResultsPage } from "@/features/exams/results-page";

export const metadata: Metadata = { title: "Results" };

export default function Route() {
  return <ResultsPage />;
}
