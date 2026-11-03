"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileBarChart, LayoutGrid, Loader2, LogOut, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";
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
      <header className="flex h-14 items-center justify-between gap-4 bg-indigo-800 px-6 text-white print:hidden">
        <span className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5" aria-hidden /> Platform console
        </span>
        <nav aria-label="Platform" className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/platform" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-white/10 aria-[current=page]:bg-white/20"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>{me.data.name}</span>
          <Button size="sm" variant="secondary" onClick={() => signOut.mutate()}>
            <LogOut aria-hidden /> Sign out
          </Button>
        </div>
      </header>
      <main id="main" className="flex-1 p-6">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
