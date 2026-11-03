import type { Metadata } from "next";
import { FamiliesPage } from "@/features/families/families-page";

export const metadata: Metadata = { title: "Families" };

export default function FamiliesRoute() {
  return <FamiliesPage />;
}
