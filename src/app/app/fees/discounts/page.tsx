import type { Metadata } from "next";
import { DiscountsPage } from "@/features/fees/discounts-page";

export const metadata: Metadata = { title: "Discounts" };

export default function Route() {
  return <DiscountsPage />;
}
