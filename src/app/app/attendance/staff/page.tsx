import type { Metadata } from "next";
import { StaffAttendancePage } from "@/features/attendance/staff-attendance-page";

export const metadata: Metadata = { title: "Staff attendance" };

export default function Route() {
  return <StaffAttendancePage />;
}
