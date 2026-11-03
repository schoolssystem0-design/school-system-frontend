import type { Metadata } from "next";
import { StudentsPage } from "@/features/students/students-page";

export const metadata: Metadata = { title: "Students" };

export default function Route() {
  return <StudentsPage />;
}
