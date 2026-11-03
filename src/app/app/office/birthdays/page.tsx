import type { Metadata } from "next";
import { BirthdaysPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Birthdays" };

export default function Route() {
  return <BirthdaysPage />;
}
