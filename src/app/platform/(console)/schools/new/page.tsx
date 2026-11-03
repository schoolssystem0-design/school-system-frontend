import type { Metadata } from "next";
import { NewSchoolPage } from "@/features/platform/platform-pages";

export const metadata: Metadata = { title: "Add school" };

export default function NewSchoolRoute() {
  return <NewSchoolPage />;
}
