import type { Metadata } from "next";
import { UsersPage } from "@/features/iam/users-page";

export const metadata: Metadata = { title: "Users" };

export default function UsersRoute() {
  return <UsersPage />;
}
