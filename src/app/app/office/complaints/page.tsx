import type { Metadata } from "next";
import { ComplaintsPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Parent complaints" };

export default function Route() {
  return <ComplaintsPage />;
}
