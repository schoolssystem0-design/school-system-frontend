import type { Metadata } from "next";
import { DayPage } from "@/features/accounts/day-page";

export const metadata: Metadata = { title: "Day book" };

export default function Route() {
  return <DayPage />;
}
