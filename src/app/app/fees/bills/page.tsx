import type { Metadata } from "next";
import { BillsPage } from "@/features/fees/bills-page";

export const metadata: Metadata = { title: "Bills & vouchers" };

export default function Route() {
  return <BillsPage />;
}
