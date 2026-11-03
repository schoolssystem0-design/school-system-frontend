import type { Metadata } from "next";
import { FeeSetupPage } from "@/features/fees/setup-page";

export const metadata: Metadata = { title: "Fee set-up" };

export default function Route() {
  return <FeeSetupPage />;
}
