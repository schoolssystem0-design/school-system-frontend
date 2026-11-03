import type { Metadata } from "next";
import { CalendarPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Calendar" };

export default function Route() {
  return <CalendarPage />;
}
