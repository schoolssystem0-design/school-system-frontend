import type { Metadata } from "next";
import { ClassesPage } from "@/features/setup/classes-page";

export const metadata: Metadata = { title: "Classes & sections" };

export default function ClassesRoute() {
  return <ClassesPage />;
}
