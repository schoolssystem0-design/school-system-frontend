import type { Metadata } from "next";
import { StaffPage } from "@/features/staff/staff-page";

export const metadata: Metadata = { title: "Staff" };

export default function Route() {
  return <StaffPage />;
}
