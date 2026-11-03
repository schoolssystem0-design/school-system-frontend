import type { Metadata } from "next";
import { YearsPage } from "@/features/setup/years-page";

export const metadata: Metadata = { title: "Academic years" };

export default function YearsRoute() {
  return <YearsPage />;
}
