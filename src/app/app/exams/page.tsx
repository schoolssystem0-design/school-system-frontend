import type { Metadata } from "next";
import { ExamsPage } from "@/features/exams/exams-page";

export const metadata: Metadata = { title: "Exams" };

export default function Route() {
  return <ExamsPage />;
}
