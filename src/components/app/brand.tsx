/* eslint-disable @next/next/no-img-element -- small static brand images from /public */
import { cn } from "@/lib/utils";

/** The company that makes and runs the system. */
export const BRAND = { name: "Tirvex Tech", product: "School Management System" } as const;

/** The full Tirvex Tech logo: "light" for light backgrounds (dark text), "dark" for dark backgrounds (white text). */
export function BrandLogo({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  return (
    <img
      src={variant === "dark" ? "/brand/tirvex-logo-dark.png" : "/brand/tirvex-logo.png"}
      alt={BRAND.name}
      width={1200}
      height={variant === "dark" ? 241 : 314}
      className={cn("h-9 w-auto", className)}
    />
  );
}

/** The square Tirvex Tech app icon. */
export function BrandIcon({ className }: { className?: string }) {
  return <img src="/brand/tirvex-icon.png" alt="" aria-hidden width={512} height={512} className={cn("size-9", className)} />;
}

/** "Powered by Tirvex Tech": a quiet credit line. */
export function PoweredBy({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-xs", dark ? "text-white/50" : "text-muted-foreground", className)}>
      <BrandIcon className="size-4 rounded-[5px]" />
      Powered by <span className={cn("font-semibold", dark ? "text-white/80" : "text-foreground/80")}>{BRAND.name}</span>
    </p>
  );
}
