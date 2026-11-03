import type { Metadata } from "next";
import { PromotionPage } from "@/features/students/promotion-page";

export const metadata: Metadata = { title: "Promotion" };

export default function Route() {
  return <PromotionPage />;
}
