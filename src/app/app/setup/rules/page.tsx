import type { Metadata } from "next";
import { RulesPage } from "@/features/setup/rules-page";

export const metadata: Metadata = { title: "Rules & settings" };

export default function RulesRoute() {
  return <RulesPage />;
}
