import type { Metadata } from "next";
import { EntriesPage } from "@/features/accounts/entries-page";

export const metadata: Metadata = { title: "Income & expenses" };

export default function Route() {
  return <EntriesPage />;
}
