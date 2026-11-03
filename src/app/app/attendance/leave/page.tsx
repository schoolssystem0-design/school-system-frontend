import type { Metadata } from "next";
import { LeavePage } from "@/features/attendance/leave-page";

export const metadata: Metadata = { title: "Leave" };

export default function Route() {
  return <LeavePage />;
}
