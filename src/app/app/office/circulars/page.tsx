import type { Metadata } from "next";
import { CircularsPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Circulars" };

export default function Route() {
  return <CircularsPage />;
}
