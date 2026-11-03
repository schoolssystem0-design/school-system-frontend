import type { Metadata } from "next";
import { TeachingPage } from "@/features/teaching/teaching-page";

export const metadata: Metadata = { title: "Teaching" };

export default function Route() {
  return <TeachingPage />;
}
