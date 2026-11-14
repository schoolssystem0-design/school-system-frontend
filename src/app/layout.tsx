import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "School Management System | Tirvex Tech", template: "%s | Tirvex Tech" },
  description: "School Management System by Tirvex Tech",
  applicationName: "Tirvex Tech School Management System",
  authors: [{ name: "Tirvex Tech" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. ColorZilla, Bitdefender) add attributes to <html>/<body>
    // before React hydrates. This only ignores attribute differences on these two elements, not their children.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
