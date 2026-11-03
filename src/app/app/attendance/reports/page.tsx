import type { Metadata } from "next";
import { AttendanceReportsPage } from "@/features/attendance/reports-page";

export const metadata: Metadata = { title: "Attendance reports" };

export default function Route() {
  return <AttendanceReportsPage />;
}
