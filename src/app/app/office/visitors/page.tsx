import type { Metadata } from "next";
import { VisitorsPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Visitors" };

export default function Route() {
  return <VisitorsPage />;
}
