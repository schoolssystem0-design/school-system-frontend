"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileBarChart, LayoutGrid, Loader2, LogOut, ScrollText } from "lucide-react";
import { BrandIcon } from "@/components/app/brand";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";
import { useIdleLogout } from "@/features/auth/use-idle-logout";
import { logout } from "@/lib/api/auth";
import { platform } from "@/lib/api/endpoints";

const NAV = [
  { href: "/platform", label: "All schools", icon: LayoutGrid },
  { href: "/platform/schools/new", label: "Add school", icon: Building2 },
  { href: "/platform/reports", label: "Reports", icon: FileBarChart },
  { href: "/platform/audit", label: "Platform audit", icon: ScrollText },
];

export function usePlatformMe() {
  return useQuery({ queryKey: ["platform", "me"], queryFn: platform.me, retry: false });
}

/** Layout of the super admin (system owner) console. */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const me = usePlatformMe();
  const denied = me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403);

  useIdleLogout({
    enabled: Boolean(me.data),
    signInPath: "/platform/sign-in",
  });

  useEffect(() => {
    if (denied) router.replace("/platform/sign-in");
  }, [denied, router]);

  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      router.replace("/platform/sign-in");
    },
  });

  if (me.isPending || denied) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" role="alert">
        <p>The server could not be reached.</p>
        <Button variant="outline" onClick={() => me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-highlight bg-navy text-white shadow-lg shadow-navy/20 print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2.5 font-semibold">
            <BrandIcon className="size-9 rounded-xl shadow-md shadow-black/30 ring-1 ring-white/15" />
            <span className="leading-tight">
              Platform console
              <span className="block text-[11px] font-normal text-white/60">Tirvex Tech · System owner</span>
            </span>
          </span>
          <nav
            aria-label="Platform"
            className="no-scrollbar order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:order-none lg:mx-auto lg:w-auto lg:px-0"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/platform" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-primary aria-[current=page]:font-medium aria-[current=page]:text-white"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm lg:ms-0">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-highlight text-xs font-semibold text-highlight-foreground">
              {(me.data.name ?? "?").trim().slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-40 truncate sm:inline">{me.data.name}</span>
            <Button size="sm" variant="secondary" className="rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => signOut.mutate()} aria-label="Sign out">
              <LogOut aria-hidden /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
