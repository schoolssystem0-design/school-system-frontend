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
  LogIn,
  LogOut,
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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
            <Sidebar me={me.data} pathname={pathname} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header me={me.data} />
              <main id="main" className="flex-1 p-6">
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

function Sidebar({ me, pathname }: { me: Me; pathname: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block print:hidden">
      <div className="mb-6 flex items-center gap-2 font-semibold">
        <School className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{me.school?.name}</span>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-4">
        {NAV.map((group, index) => {
          const items = group.items.filter((item) => !item.permission || can(me.permissions, item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.title ?? index}>
              {group.title && (
                <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        aria-current={active ? "page" : undefined}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
                      >
                        <Icon className="size-4" aria-hidden />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function YearSwitcher() {
  const { years, selected, select } = useYear();
  if (years.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Year</span>
      <NativeSelect
        className="w-36"
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

function Header({ me }: { me: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selected } = useYear();
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      router.replace(me.superAdmin ? "/platform/sign-in" : "/sign-in");
    },
  });

  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-6 py-2 print:hidden">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground md:hidden">{me.school?.name}</span>
        <YearSwitcher />
        {selected?.status === "CLOSED" && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Closed year: read-only except authorised corrections
          </span>
        )}
      </div>
      <div className="ms-auto flex items-center gap-3">
        <span className="text-sm">
          {me.displayName} <span className="text-muted-foreground">({me.school?.code})</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          <LogOut aria-hidden />
          Sign out
        </Button>
      </div>
    </header>
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
    <div className="flex items-center justify-between gap-3 bg-indigo-700 px-6 py-2 text-sm text-white" role="status">
      <span className="flex items-center gap-2">
        <ShieldCheck className="size-4" aria-hidden />
        Super admin: viewing <strong>{schoolName}</strong> with full access. Every action is recorded.
      </span>
      <Button size="sm" variant="secondary" onClick={() => leave.mutate()} disabled={leave.isPending}>
        Back to platform
      </Button>
    </div>
  );
}
