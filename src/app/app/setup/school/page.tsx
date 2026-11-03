import type { Metadata } from "next";
import { SchoolProfilePage } from "@/features/setup/school-profile-page";

export const metadata: Metadata = { title: "School profile" };

export default function SchoolProfileRoute() {
  return <SchoolProfilePage />;
}
