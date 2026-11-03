import type { Metadata } from "next";
import { FeeReportsPage } from "@/features/fees/reports-page";

export const metadata: Metadata = { title: "Fee reports" };

export default function Route() {
  return <FeeReportsPage />;
}
