"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlarmClock,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Cake,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  ClipboardPen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Contact,
  DoorOpen,
  FileBarChart,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  GraduationCap,
  HandCoins,
  Home,
  Landmark,
  LineChart,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Menu,
  PenLine,
  Percent,
  PieChart,
  Plane,
  Receipt,
  ScrollText,
  School,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NativeSelect } from "@/components/app/native-select";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";
import { fetchMe, logout, meQueryKey, type Me } from "@/lib/api/auth";
import { platform } from "@/lib/api/endpoints";
import { can, P, type Permission } from "@/lib/permissions";
import { StepUpProvider } from "@/features/step-up/step-up-provider";
import { YearProvider, useYear } from "./year-context";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission };

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/app", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "People",
    items: [
      { href: "/app/admissions", label: "Admissions", icon: ClipboardList, permission: P.ADMISSIONS_VIEW },
      { href: "/app/students", label: "Students", icon: GraduationCap, permission: P.STUDENTS_VIEW },
      { href: "/app/families", label: "Families", icon: Home, permission: P.FAMILIES_VIEW },
      { href: "/app/staff", label: "Staff", icon: Contact, permission: P.STAFF_VIEW },
      { href: "/app/teaching", label: "Teaching & timetable", icon: CalendarClock, permission: P.ACADEMICS_VIEW },
    ],
  },
  {
    title: "Attendance",
    items: [
      { href: "/app/attendance", label: "Take attendance", icon: ClipboardCheck, permission: P.ATTENDANCE_VIEW },
      { href: "/app/attendance/leave", label: "Leave", icon: Plane, permission: P.ATTENDANCE_LEAVE_MANAGE },
      { href: "/app/attendance/staff", label: "Staff attendance", icon: UserCheck, permission: P.ATTENDANCE_STAFF_MARK },
      { href: "/app/attendance/reports", label: "Attendance reports", icon: PieChart, permission: P.ATTENDANCE_VIEW },
    ],
  },
  {
    title: "Office",
    items: [
      { href: "/app/office/tasks", label: "Tasks", icon: ClipboardPen, permission: P.OFFICE_TASKS },
      { href: "/app/office/complaints", label: "Parent complaints", icon: MessageSquareWarning, permission: P.OFFICE_COMPLAINTS_VIEW },
      { href: "/app/office/circulars", label: "Circulars", icon: Megaphone, permission: P.OFFICE_CIRCULARS_VIEW },
      { href: "/app/office/calendar", label: "Calendar", icon: CalendarDays, permission: P.OFFICE_EVENTS_VIEW },
      { href: "/app/office/visitors", label: "Visitors", icon: DoorOpen, permission: P.OFFICE_VISITORS_VIEW },
      { href: "/app/office/birthdays", label: "Birthdays", icon: Cake, permission: P.STUDENTS_PRIVATE_VIEW },
      { href: "/app/messages", label: "Messages", icon: MessageSquare, permission: P.MESSAGES_VIEW },
    ],
  },
  {
    title: "Marks",
    items: [{ href: "/app/marks", label: "Test marks", icon: PenLine, permission: P.EXAMS_VIEW }],
  },
  {
    title: "Fees",
    items: [
      { href: "/app/fees/collect", label: "Collect fees", icon: Banknote, permission: P.FEES_PAYMENT_ADD },
      { href: "/app/fees/bills", label: "Bills & vouchers", icon: Receipt, permission: P.FEES_VIEW },
      { href: "/app/fees/payments", label: "Payments & corrections", icon: ScrollText, permission: P.FEES_VIEW },
      { href: "/app/fees/discounts", label: "Discounts", icon: Percent, permission: P.FEES_VIEW },
      { href: "/app/fees/defaulters", label: "Fee status & defaulters", icon: AlarmClock, permission: P.FEES_VIEW },
      { href: "/app/fees/reports", label: "Fee reports", icon: BarChart3, permission: P.FEES_REPORTS_VIEW },
      { href: "/app/fees/setup", label: "Fee set-up", icon: Wallet, permission: P.FEES_VIEW },
    ],
  },
  {
    title: "Accounts & payroll",
    items: [
      { href: "/app/accounts/entries", label: "Income & expenses", icon: ArrowLeftRight, permission: P.ACCOUNTS_VIEW },
      { href: "/app/accounts/day", label: "Day book & close", icon: CalendarCheck, permission: P.ACCOUNTS_VIEW },
      { href: "/app/accounts", label: "Cash & bank", icon: Landmark, permission: P.ACCOUNTS_VIEW },
      { href: "/app/accounts/reports", label: "Financial reports", icon: LineChart, permission: P.ACCOUNTS_REPORTS_VIEW },
      { href: "/app/payroll", label: "Payroll", icon: HandCoins, permission: P.PAYROLL_VIEW },
    ],
  },
  {
    title: "Reports",
    items: [{ href: "/app/reports", label: "Reports", icon: FileBarChart, permission: P.REPORTS_VIEW }],
  },
  {
    title: "School setup",
    items: [
      { href: "/app/setup/school", label: "School profile", icon: School, permission: P.SCHOOL_PROFILE_VIEW },
      { href: "/app/setup/years", label: "Academic years", icon: CalendarDays },
      { href: "/app/setup/classes", label: "Classes & sections", icon: BookOpen, permission: P.ACADEMICS_VIEW },
      { href: "/app/setup/subjects", label: "Subjects & marks", icon: Settings2, permission: P.ACADEMICS_VIEW },
      { href: "/app/setup/rules", label: "Rules & settings", icon: SlidersHorizontal, permission: P.SETTINGS_VIEW },
    ],
  },
  {
    title: "Users & security",
    items: [
      { href: "/app/users", label: "Users", icon: Users, permission: P.IAM_USER_VIEW },
      { href: "/app/roles", label: "Roles & permissions", icon: UserCog, permission: P.IAM_ROLE_VIEW },
      { href: "/app/security/logins", label: "Login history", icon: LogIn, permission: P.IAM_LOGIN_HISTORY_VIEW },
      { href: "/app/security/activity", label: "Activity history", icon: Activity, permission: P.AUDIT_VIEW },
    ],
  },
  { items: [{ href: "/app/account", label: "My account", icon: KeyRound }] },
];

const ALL_HREFS = NAV.flatMap((g) => g.items.map((i) => i.href));

const matches = (href: string, pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The menu item for the page: the longest link that matches (so /app/accounts is not lit on /app/accounts/day). */
function isActive(href: string, pathname: string) {
  if (!matches(href, pathname)) return false;
  return !ALL_HREFS.some((other) => other.length > href.length && matches(other, pathname));
}

/** Menu pages this user may open, for the dashboard quick bar. */
export function navItems(permissions: readonly string[]) {
  return NAV.flatMap((group) => group.items).filter((item) => !item.permission || can(permissions, item.permission));
}

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: fetchMe });
}

/** Protected layout for the school portal: loads the signed-in user, sends anyone else to sign-in. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();

  const unauthenticated = me.error instanceof ApiError && me.error.status === 401;
  const needsPasswordChange = me.data?.mustChangePassword && pathname !== "/app/account";
  const superAdminOutsideSchool = me.data?.superAdmin && !me.data.school;

  useEffect(() => {
    if (unauthenticated) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    else if (superAdminOutsideSchool) router.replace("/platform");
    else if (needsPasswordChange) router.replace("/app/account?required=1");
  }, [unauthenticated, superAdminOutsideSchool, needsPasswordChange, router, pathname]);

  if (me.isPending || unauthenticated || superAdminOutsideSchool) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (me.isError || !me.data.school) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <p>The server could not be reached.</p>
        <Button variant="outline" onClick={() => me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <YearProvider schoolId={me.data.school.id ?? 0}>
      <StepUpProvider>
        <div className="flex flex-1 flex-col">
          {me.data.superAdmin && <SuperAdminBanner schoolName={me.data.school.name ?? ""} />}
          <div className="flex flex-1">
            <aside className="sticky top-0 hidden h-svh w-68 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex print:hidden">
              <SidebarContent me={me.data} pathname={pathname} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <Header me={me.data} pathname={pathname} />
              <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                {children}
              </main>
            </div>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </StepUpProvider>
    </YearProvider>
  );
}

/** Two-letter initials for the avatar bubble. */
export function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/** Brand block, menu groups. Shared by the desktop sidebar and the mobile drawer (only one is ever rendered visibly). */
function SidebarContent({ me, pathname, onNavigate }: { me: Me; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/25">
          <School className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{me.school?.name}</p>
          <p className="text-xs text-muted-foreground">School portal</p>
        </div>
      </div>
      <nav aria-label="Main" className="scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {NAV.map((group, index) => {
          const items = group.items.filter((item) => !item.permission || can(me.permissions, item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.title ?? index}>
              {group.title && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {group.title}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href, pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary md:py-1.5"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary opacity-0 transition-opacity group-aria-[current=page]:opacity-100"
                        />
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-aria-[current=page]:text-primary"
                          aria-hidden
                        />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}

/** Slide-in menu for phones and small tablets. Rendered only while open, so menu links are never duplicated. */
function MobileDrawer({ me, pathname, onClose }: { me: Me; pathname: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-3 z-10"
          onClick={onClose}
          aria-label="Close menu"
          autoFocus
        >
          <X aria-hidden />
        </Button>
        <SidebarContent me={me} pathname={pathname} onNavigate={onClose} />
      </div>
    </div>
  );
}

function YearSwitcher() {
  const { years, selected, select } = useYear();
  if (years.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
        <CalendarRange className="size-4" aria-hidden />
        Year
      </span>
      <NativeSelect
        className="h-9 w-36 rounded-full bg-card sm:w-48"
        value={selected?.id ?? ""}
        onChange={(e) => select(Number(e.target.value))}
        aria-label="Academic year"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.status === "CURRENT" ? " (current)" : y.status === "CLOSED" ? " (closed)" : ""}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function Header({ me, pathname }: { me: Me; pathname: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selected } = useYear();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      router.replace(me.superAdmin ? "/platform/sign-in" : "/sign-in");
    },
  });

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 print:hidden">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <span className="min-w-0 truncate text-sm font-semibold md:hidden">{me.school?.name}</span>
          <div className="hidden md:block">
            <YearSwitcher />
          </div>
          {selected?.status === "CLOSED" && (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 lg:flex dark:bg-amber-500/15 dark:text-amber-200">
              <Lock className="size-3.5" aria-hidden />
              Closed year: read-only except authorised corrections
            </span>
          )}
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <div className="md:hidden">
              <YearSwitcher />
            </div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="hidden size-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-semibold text-white ring-2 ring-background sm:flex"
              >
                {initials(me.displayName)}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="max-w-40 truncate text-sm font-medium">{me.displayName}</span>
                <span className="text-xs text-muted-foreground">({me.school?.code})</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-3"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              aria-label="Sign out"
            >
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        {selected?.status === "CLOSED" && (
          <p className="flex items-center gap-1.5 border-t bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 lg:hidden dark:bg-amber-500/10 dark:text-amber-200">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Closed year: read-only except authorised corrections
          </p>
        )}
      </header>
      {/* Outside the header: its backdrop blur would otherwise trap this fixed overlay inside the header box. */}
      {menuOpen && <MobileDrawer me={me} pathname={pathname} onClose={closeMenu} />}
    </>
  );
}

function SuperAdminBanner({ schoolName }: { schoolName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = useMutation({
    mutationFn: platform.leaveSchool,
    onSuccess: () => {
      queryClient.clear();
      router.push("/platform");
    },
  });
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 px-4 py-2 text-sm text-white sm:px-6 print:hidden"
      role="status"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        <span>
          Super admin: viewing <strong>{schoolName}</strong> with full access. Every action is recorded.
        </span>
      </span>
      <Button size="sm" variant="secondary" onClick={() => leave.mutate()} disabled={leave.isPending}>
        Back to platform
      </Button>
    </div>
  );
}
