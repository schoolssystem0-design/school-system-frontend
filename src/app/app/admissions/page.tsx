import type { Metadata } from "next";
import { AdmissionsPage } from "@/features/admissions/admissions-page";

export const metadata: Metadata = { title: "Admissions" };

export default function Route() {
  return <AdmissionsPage />;
}
