import type { Metadata } from "next";
import { StudentImportPage } from "@/features/students/import-page";

export const metadata: Metadata = { title: "Import students" };

export default function Route() {
  return <StudentImportPage />;
}
