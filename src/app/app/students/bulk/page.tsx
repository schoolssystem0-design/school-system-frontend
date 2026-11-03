import type { Metadata } from "next";
import { BulkPage } from "@/features/students/bulk-page";

export const metadata: Metadata = { title: "Bulk edit" };

export default function Route() {
  return <BulkPage />;
}
