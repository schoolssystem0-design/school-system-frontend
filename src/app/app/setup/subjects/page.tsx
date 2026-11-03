import type { Metadata } from "next";
import { SubjectsPage } from "@/features/setup/subjects-page";

export const metadata: Metadata = { title: "Subjects & marks" };

export default function SubjectsRoute() {
  return <SubjectsPage />;
}
