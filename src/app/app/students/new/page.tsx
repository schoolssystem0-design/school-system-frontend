import type { Metadata } from "next";
import { AdmitPage } from "@/features/students/admit-page";

export const metadata: Metadata = { title: "New admission" };

export default function Route() {
  return <AdmitPage />;
}
