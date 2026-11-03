import type { Metadata } from "next";
import { AccountsReportsPage } from "@/features/accounts/reports-page";

export const metadata: Metadata = { title: "Financial reports" };

export default function Route() {
  return <AccountsReportsPage />;
}
