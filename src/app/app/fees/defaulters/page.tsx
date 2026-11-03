import type { Metadata } from "next";
import { DefaultersPage } from "@/features/fees/defaulters-page";

export const metadata: Metadata = { title: "Fee status" };

export default function Route() {
  return <DefaultersPage />;
}
