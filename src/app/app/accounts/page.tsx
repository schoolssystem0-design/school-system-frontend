import type { Metadata } from "next";
import { MoneyAccountsPage } from "@/features/accounts/money-accounts-page";

export const metadata: Metadata = { title: "Cash & bank" };

export default function Route() {
  return <MoneyAccountsPage />;
}
