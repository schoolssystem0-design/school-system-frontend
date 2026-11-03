import type { Metadata } from "next";
import { RolesPage } from "@/features/iam/roles-page";

export const metadata: Metadata = { title: "Roles & permissions" };

export default function RolesRoute() {
  return <RolesPage />;
}
