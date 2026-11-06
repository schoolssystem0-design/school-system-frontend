"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  ChevronRight,
  Copy,
  Plug,
  RefreshCw,
  Send,
  Smartphone,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { messages, smsPhone, type PhoneStatus } from "@/lib/api/office";
import { formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/people/shared";
import { useStepUp } from "@/features/step-up/step-up-provider";

const onError = (e: unknown) => toast.error(errorMessage(e));

const CLOUD_URL = "https://api.sms-gate.app/3rdparty/v1";

/** The local development server's built-in pretend phone (sends nothing). */
const isPretendPhone = (url: string) => url.includes("/dev/sms-gate");

/** Counter labels, in the order a message moves through them. */
export const SMS_STATES: { key: string; label: string; tone: string }[] = [
  { key: "PENDING", label: "Waiting", tone: "bg-muted text-muted-foreground" },
  { key: "QUEUED", label: "With the phone", tone: "bg-primary/10 text-primary" },
  { key: "SENT", label: "Sent", tone: "bg-primary/10 text-primary" },
  { key: "DELIVERED", label: "Delivered", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { key: "FAILED", label: "Failed", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  { key: "CANCELLED", label: "Cancelled", tone: "bg-muted text-muted-foreground" },
];

const PURPOSE_LABEL: Record<string, string> = {
  ATTENDANCE_ABSENT: "Absence",
  NOTICE: "Notice",
  WELCOME: "Welcome",
  BIRTHDAY: "Birthday",
  FEE_RECEIPT: "Fee receipt",
  FEE_REMINDER: "Fee reminder",
  RESULT: "Result",
  TEST_MARKS: "Test marks",
  TEST: "Test SMS",
  OPT_OUT_CONFIRM: "Opt-out reply",
};

export function usePhoneStatus(enabled = true) {
  return useQuery({ queryKey: ["messages", "sms-phone"], queryFn: smsPhone.status, refetchInterval: 30_000, enabled });
}

function BatteryIcon({ level, charging }: { level?: number | null; charging?: boolean | null }) {
  const Icon = charging ? BatteryCharging : level == null ? BatteryMedium : level < 25 ? BatteryLow : level < 70 ? BatteryMedium : BatteryFull;
  return <Icon className={cn("size-4", level != null && level < 25 && !charging && "text-rose-600")} aria-hidden />;
}

/** Online / offline / not connected, as a pill. */
export function PhoneStatePill({ s }: { s: PhoneStatus }) {
  if (!s.configured) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Not connected</span>;
  }
  if (!s.enabled) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Switched off</span>;
  }
  return s.online ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight/15 px-2.5 py-0.5 text-xs font-medium text-highlight-ink">
      <WifiOff className="size-3" aria-hidden /> Offline
    </span>
  );
}

function Counts({ s }: { s: PhoneStatus }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {SMS_STATES.map((st) => (
        <div key={st.key} className={cn("rounded-lg px-2.5 py-2", st.tone)}>
          <dt className="text-[11px] font-medium leading-tight">{st.label}</dt>
          <dd className="text-lg font-bold tabular-nums">{s.today?.[st.key] ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Full panel on the Messages page: health, today's counts, failed messages, test SMS and the connection form. */
export function SmsPhonePanel() {
  const can = useCan();
  const status = usePhoneStatus();
  if (status.isPending) return <Loading />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  const s = status.data;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <StatusCard s={s} />
        {s.configured && can(P.MESSAGES_SEND) && <TestCard s={s} />}
        {(s.failed ?? []).length > 0 && <FailedCard s={s} />}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {can(P.SETTINGS_EDIT) ? <ConnectCard s={s} /> : !s.configured && (
          <Alert>
            <AlertTitle>No SMS phone yet</AlertTitle>
            <AlertDescription>Ask someone who can change school settings to connect the school&apos;s SMS phone.</AlertDescription>
          </Alert>
        )}
        <SetupGuide s={s} />
      </div>
    </div>
  );
}

function StatusCard({ s }: { s: PhoneStatus }) {
  const limit = s.dailyLimit ?? 0;
  const used = s.handedOverToday ?? 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            School SMS phone <PhoneStatePill s={s} />
          </CardTitle>
          <CardDescription>
            {s.configured
              ? s.lastSeenAt ? `Last heard from ${formatDateTime(s.lastSeenAt)}` : "Not heard from yet: open the SMS Gate app and start the service."
              : "SMS go through the school's own Android phone and SIM. Connect it to start."}
          </CardDescription>
        </div>
        {s.configured && (s.batteryLevel != null || s.charging != null) && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums" title="Phone battery">
            <BatteryIcon level={s.batteryLevel} charging={s.charging} />
            {s.batteryLevel != null ? `${s.batteryLevel}%` : ""}
            <span className="sr-only">{s.charging ? "charging" : "not charging"}</span>
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {s.alert && (
          <Alert className="border-highlight/40 bg-highlight/10">
            <AlertTriangle className="text-highlight-ink" aria-hidden />
            <AlertTitle>The phone is offline and {s.waiting} message{s.waiting === 1 ? " is" : "s are"} waiting</AlertTitle>
            <AlertDescription>
              Check that it is switched on, charging and on Wi-Fi or mobile data, and that the SMS Gate service is running. Waiting messages go out by
              themselves once it is back.
            </AlertDescription>
          </Alert>
        )}
        {s.configured && s.lastRefusedReason && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>The phone is reaching the system, but its reports are refused</AlertTitle>
            <AlertDescription>
              {s.lastRefusedReason}. Last refused {formatDateTime(s.lastRefusedAt)}.
            </AlertDescription>
          </Alert>
        )}
        {s.configured && isPretendPhone(s.baseUrl ?? "") && (
          <Alert className="border-highlight/40 bg-highlight/10">
            <AlertTriangle className="text-highlight-ink" aria-hidden />
            <AlertTitle>Connected to the pretend phone</AlertTitle>
            <AlertDescription>Messages here are not really sent. Switch the server address to the SMS Gate cloud to use your phone.</AlertDescription>
          </Alert>
        )}
        {s.configured && !s.webhooksRegistered && (
          <Alert>
            <AlertTitle>No delivery reports from the phone yet</AlertTitle>
            <AlertDescription>
              SMS are still sent. Each one is checked with SMS Gate about a minute later. For instant reports the server needs a public https address
              (APP_PUBLIC_API_URL); then press Set up reports again.
            </AlertDescription>
          </Alert>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">Today</p>
          <Counts s={s} />
        </div>
        {s.configured && limit > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Handed to the phone today</span>
              <span className="tabular-nums">
                {used} of {limit}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Daily SMS limit used"
              aria-valuenow={Math.min(used, limit)}
              aria-valuemin={0}
              aria-valuemax={limit}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <span
                className={cn("block h-full rounded-full", used >= limit ? "bg-highlight" : "bg-primary")}
                style={{ width: `${Math.min(100, (used * 100) / limit)}%` }}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Quiet hours, the daily limit and automatic birthday SMS are in{" "}
          <Link href="/app/setup/rules" className="font-medium text-primary underline-offset-2 hover:underline">
            Rules &amp; settings
          </Link>{" "}
          under Messages.
        </p>
      </CardContent>
    </Card>
  );
}

function TestCard({ s }: { s: PhoneStatus }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const test = useMutation({
    mutationFn: () => smsPhone.test(phone),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Test SMS handed to the phone. It should arrive within a minute.");
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send a test SMS</CardTitle>
        <CardDescription>Goes out straight away, even in quiet hours. Use your own number.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            test.mutate();
          }}
        >
          <Field id="sp-test" label="Mobile number" className="flex-1">
            <Input id="sp-test" inputMode="tel" autoComplete="tel" placeholder="0300-1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Button type="submit" disabled={!phone.trim() || test.isPending || !s.enabled}>
            <Send aria-hidden /> {test.isPending ? "Sending…" : "Send test"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FailedCard({ s }: { s: PhoneStatus }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: messages.retry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("It will be sent again");
    },
    onError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent failed SMS</CardTitle>
        <CardDescription>The full list is in the delivery log.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {(s.failed ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium tabular-nums">{f.recipient}</span>
                <span className="text-muted-foreground"> · {PURPOSE_LABEL[f.purpose ?? ""] ?? f.purpose}</span>
                <span className="block text-xs text-muted-foreground">{f.error}</span>
              </span>
              {can(P.MESSAGES_SEND) && (
                <Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(f.id ?? 0)}>
                  <RefreshCw aria-hidden /> Send again
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ConnectCard({ s }: { s: PhoneStatus }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(s.baseUrl ?? s.defaultBaseUrl ?? "");
  const [username, setUsername] = useState(s.username ?? "");
  const [password, setPassword] = useState("");
  const [signingKey, setSigningKey] = useState("");
  const [sim, setSim] = useState(s.simNumber ? String(s.simNumber) : "");
  const [alertEmail, setAlertEmail] = useState(s.alertEmail ?? "");
  const [enabled, setEnabled] = useState(s.configured ? s.enabled !== false : true);
  const [confirmOff, setConfirmOff] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["messages", "sms-phone"] });
  const save = useMutation({
    mutationFn: () =>
      guard(() =>
        smsPhone.connect({
          baseUrl: baseUrl.trim() || undefined,
          username: username.trim(),
          password: password || undefined,
          signingKey: signingKey || undefined,
          simNumber: sim ? Number(sim) : undefined,
          alertEmail: alertEmail.trim() || undefined,
          enabled,
        }),
      ),
    onSuccess: (result) => {
      setPassword("");
      setSigningKey("");
      refresh();
      if (result.notice) toast.warning(result.notice, { duration: 20_000 });
      else toast.success(s.configured ? "SMS phone settings saved" : "SMS phone connected");
    },
    onError,
  });
  const webhooks = useMutation({
    mutationFn: smsPhone.registerWebhooks,
    onSuccess: () => {
      refresh();
      toast.success("Delivery reports set up again");
    },
    onError,
  });
  const disconnect = useMutation({
    mutationFn: () => guard(() => smsPhone.disconnect()),
    onSuccess: () => {
      setConfirmOff(false);
      refresh();
      toast.success("SMS phone disconnected");
    },
    onError,
  });
  const ready = username.trim() && (s.configured || (password && signingKey));
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight/15 text-highlight-ink">
          <Plug className="size-5" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base">{s.configured ? "Connection" : "Connect the phone"}</CardTitle>
          <CardDescription>Copy these from the SMS Gate app on the phone. They are checked, then stored encrypted.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field id="sp-user" label="Username" hint="App: Home, Cloud Server">
            <Input id="sp-user" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field id="sp-pass" label="Password" hint={s.configured ? "Saved. Leave blank to keep it." : "App: Home, Cloud Server"}>
            <Input id="sp-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field id="sp-key" label="Webhook signing key" hint={s.configured ? "Saved. Leave blank to keep it." : "App: Settings, Webhooks, Signing Key"}>
            <Input id="sp-key" type="password" autoComplete="off" value={signingKey} onChange={(e) => setSigningKey(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="sp-sim" label="Send from">
              <NativeSelect id="sp-sim" value={sim} onChange={(e) => setSim(e.target.value)}>
                <option value="">The phone decides</option>
                <option value="1">SIM 1</option>
                <option value="2">SIM 2</option>
                <option value="3">SIM 3</option>
              </NativeSelect>
            </Field>
            <Field id="sp-email" label="Offline alerts to" hint="Email, not SMS">
              <Input id="sp-email" type="email" autoComplete="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
            </Field>
          </div>
          {isPretendPhone(baseUrl) && (
            <Alert className="border-highlight/40 bg-highlight/10">
              <AlertTriangle className="text-highlight-ink" aria-hidden />
              <AlertTitle>Pretend phone (local testing only)</AlertTitle>
              <AlertDescription>
                No real SMS are sent: messages go to a pretend phone inside the system. To send through your real phone, open Server address
                below, choose <b>Use SMS Gate cloud</b> and save.
              </AlertDescription>
            </Alert>
          )}
          <details className="rounded-lg border px-3 py-2 text-sm" open={isPretendPhone(baseUrl) || undefined}>
            <summary className="cursor-pointer font-medium">Server address</summary>
            <Field id="sp-url" label="SMS Gate server" hint="Keep the standard address unless you run your own server" className="mt-2">
              <Input id="sp-url" inputMode="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </Field>
            {baseUrl !== CLOUD_URL && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setBaseUrl(CLOUD_URL)}>
                Use SMS Gate cloud
              </Button>
            )}
          </details>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Send SMS through this phone
          </label>
          {!s.secretsAvailable && (
            <Alert>
              <AlertTitle>The server cannot store passwords yet</AlertTitle>
              <AlertDescription>The system owner must set APP_SECRETS_KEY on the server first.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!ready || save.isPending}>
              {save.isPending ? "Checking…" : s.configured ? "Save" : "Connect"}
            </Button>
            {s.configured && (
              <>
                <Button type="button" variant="outline" disabled={webhooks.isPending} onClick={() => webhooks.mutate()}>
                  <RefreshCw aria-hidden /> Set up reports again
                </Button>
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmOff(true)}>
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Disconnect the SMS phone?"
        description="Messages will no longer go through this phone. Messages already sent stay in the delivery log."
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
      />
    </Card>
  );
}

function SetupGuide({ s }: { s: PhoneStatus }) {
  const steps = [
    "Put a SIM with an SMS bundle in an Android phone (5.0 or newer) and keep it on the charger.",
    "Install SMS Gateway for Android from its GitHub releases page, allow SMS and notifications.",
    "In the app, switch on Cloud Server and tap Start. Copy the username and password into this form.",
    "In the app: Settings, Webhooks, Signing Key. Copy it here too.",
    "Phone settings, Apps, SMS Gateway, Battery: Unrestricted. Turn off cleaner apps for it.",
    "In the app's Messages settings, set a limit of about 20–30 SMS per 30 minutes to keep the SIM healthy.",
    "Send a test SMS from this page, then tell parents the school's SMS number.",
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Setting up the phone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2 text-sm">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2.5">
              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {s.webhookUrl && (
          <div className="rounded-lg bg-muted p-3 text-xs">
            <p className="mb-1 font-medium">Delivery reports arrive at</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate">{s.webhookUrl}</code>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Copy the address"
                onClick={() => {
                  void navigator.clipboard?.writeText(s.webhookUrl ?? "");
                  toast.success("Copied");
                }}
              >
                <Copy aria-hidden />
              </Button>
            </div>
            <p className="mt-1 text-muted-foreground">Registered on the phone automatically when you save. Parents can reply STOP to stop SMS.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Dashboard card: is the phone working, and how did today's SMS go. */
export function SmsPhoneCard() {
  const status = usePhoneStatus();
  if (status.isPending || status.isError) return null;
  const s = status.data;
  const delivered = (s.today?.DELIVERED ?? 0) + (s.today?.SENT ?? 0);
  const failed = s.today?.FAILED ?? 0;
  return (
    <section aria-labelledby="sms-phone-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sms-phone-title" className="flex flex-wrap items-center gap-2 text-base font-semibold">
            SMS phone <PhoneStatePill s={s} />
          </h2>
          <p className="text-xs text-muted-foreground">
            {!s.configured ? "Not connected yet" : s.lastSeenAt ? `Last heard from ${formatDateTime(s.lastSeenAt)}` : "Not heard from yet"}
          </p>
        </div>
        <Link href="/app/messages?tab=phone" className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          {s.configured ? "Open" : "Connect"} <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {s.alert && (
        <p className="flex items-start gap-2 rounded-lg bg-highlight/10 px-3 py-2 text-sm font-medium text-highlight-ink" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Phone offline: {s.waiting} message{s.waiting === 1 ? "" : "s"} waiting
        </p>
      )}
      {s.configured && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted px-2 py-2">
            <dt className="text-[11px] text-muted-foreground">Waiting</dt>
            <dd className="text-lg font-bold tabular-nums">{s.waiting ?? 0}</dd>
          </div>
          <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
            <dt className="text-[11px] text-emerald-700 dark:text-emerald-300">Sent today</dt>
            <dd className="text-lg font-bold tabular-nums">{delivered}</dd>
          </div>
          <div className={cn("rounded-lg px-2 py-2", failed > 0 ? "bg-rose-500/10" : "bg-muted")}>
            <dt className={cn("text-[11px]", failed > 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>Failed today</dt>
            <dd className="text-lg font-bold tabular-nums">{failed}</dd>
          </div>
        </dl>
      )}
      {s.configured && (s.batteryLevel != null || s.charging != null) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BatteryIcon level={s.batteryLevel} charging={s.charging} />
          Battery {s.batteryLevel != null ? `${s.batteryLevel}%` : "unknown"}
          {s.charging ? ", charging" : s.charging === false ? ", not charging" : ""}
        </p>
      )}
    </section>
  );
}
