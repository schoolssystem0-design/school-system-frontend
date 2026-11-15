"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Coffee, Lock, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { school } from "@/lib/api/endpoints";
import { teaching, type BellSlot, type Period, type TimetableProposal } from "@/lib/api/people";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { sectionOptions, useCan, useClasses } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const short = (day: string) => day.charAt(0) + day.slice(1, 3).toLowerCase();
const hhmm = (t?: string) => (t ?? "").slice(0, 5);

/** The school's bell schedule for the year (shared with the timetable editor for period times). */
export function useBellSchedule(yearId: number) {
  return useQuery({ queryKey: ["teaching", yearId, "bell-schedule"], queryFn: () => teaching.bellSchedule(yearId) });
}

/** Working days of the year, with their weekday numbers (1 = Monday). */
function useDays(yearId: number) {
  const week = useQuery({ queryKey: ["school", "week", yearId], queryFn: () => school.week(yearId) });
  const days = DAYS.map((d, i) => ({ name: d, weekday: i + 1 })).filter((d) => (week.data?.[d.name] ?? "FULL") !== "OFF");
  return { days, loading: week.isPending };
}

/** Teaching → Auto-generate: the bell schedule, then a whole-school timetable to preview and save. */
export function AutoTimetable({ yearId }: { yearId: number }) {
  const bells = useBellSchedule(yearId);
  if (bells.isPending) return <Loading />;
  if (bells.isError) return <ErrorState error={bells.error} onRetry={() => bells.refetch()} />;
  const hasPeriods = bells.data.some((s) => s.kind === "PERIOD");
  return (
    <div className="flex flex-col gap-6">
      <BellScheduleCard key={bells.dataUpdatedAt} yearId={yearId} initial={bells.data} />
      {hasPeriods ? (
        <Generator yearId={yearId} bells={bells.data} />
      ) : (
        <Alert>
          <AlertDescription>Set the bell schedule above first: the generator fills these periods.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ------------------------------------------------------------ bell schedule

type Row = { kind: "PERIOD" | "BREAK"; label: string; start: string; end: string; onHalfDay: boolean };

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function BellScheduleCard({ yearId, initial }: { yearId: number; initial: BellSlot[] }) {
  const can = useCan();
  const manage = can(P.ACADEMICS_MANAGE);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((s) => ({
      kind: s.kind === "BREAK" ? "BREAK" : "PERIOD",
      label: s.label ?? "",
      start: hhmm(s.startTime),
      end: hhmm(s.endTime),
      onHalfDay: s.onHalfDay ?? true,
    })),
  );
  const [quick, setQuick] = useState({ start: "08:00", periods: "8", minutes: "40", breakAfter: "4", breakMinutes: "30" });
  const save = useMutation({
    mutationFn: () =>
      teaching.saveBellSchedule(
        yearId,
        rows.map((r) => ({
          kind: r.kind,
          label: r.label.trim() || undefined,
          startTime: `${r.start}:00`,
          endTime: `${r.end}:00`,
          onHalfDay: r.onHalfDay,
        })),
      ),
    onSuccess: () => {
      toast.success("Bell schedule saved");
      void queryClient.invalidateQueries({ queryKey: ["teaching", yearId, "bell-schedule"] });
    },
    onError,
  });
  const set = (i: number, patch: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const last = rows.at(-1)?.end || "08:00";
  const fill = () => {
    const n = Math.min(15, Math.max(1, Number(quick.periods) || 0));
    const len = Math.max(5, Number(quick.minutes) || 40);
    const after = Number(quick.breakAfter) || 0;
    const out: Row[] = [];
    let t = quick.start;
    for (let p = 1; p <= n; p++) {
      out.push({ kind: "PERIOD", label: "", start: t, end: addMinutes(t, len), onHalfDay: p <= Math.ceil(n / 2) });
      t = addMinutes(t, len);
      if (p === after && p < n) {
        const b = Math.max(5, Number(quick.breakMinutes) || 30);
        out.push({ kind: "BREAK", label: "Break", start: t, end: addMinutes(t, b), onHalfDay: true });
        t = addMinutes(t, b);
      }
    }
    setRows(out);
  };
  let periodNo = 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="size-5 text-primary" aria-hidden /> Bell schedule
        </CardTitle>
        <CardDescription>
          The periods of the school day and the breaks between them. Untick “Half day” for periods that do not happen on
          half days. Double periods are never split by a break.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {manage && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
            <p className="w-full text-sm font-medium">Fill quickly</p>
            <Field id="q-start" label="Day starts">
              <Input id="q-start" type="time" className="w-28" value={quick.start} onChange={(e) => setQuick({ ...quick, start: e.target.value })} />
            </Field>
            <Field id="q-periods" label="Periods">
              <Input id="q-periods" inputMode="numeric" className="w-20" value={quick.periods} onChange={(e) => setQuick({ ...quick, periods: e.target.value })} />
            </Field>
            <Field id="q-minutes" label="Minutes each">
              <Input id="q-minutes" inputMode="numeric" className="w-20" value={quick.minutes} onChange={(e) => setQuick({ ...quick, minutes: e.target.value })} />
            </Field>
            <Field id="q-after" label="Break after period">
              <Input id="q-after" inputMode="numeric" className="w-20" value={quick.breakAfter} onChange={(e) => setQuick({ ...quick, breakAfter: e.target.value })} />
            </Field>
            <Field id="q-break" label="Break minutes">
              <Input id="q-break" inputMode="numeric" className="w-20" value={quick.breakMinutes} onChange={(e) => setQuick({ ...quick, breakMinutes: e.target.value })} />
            </Field>
            <Button type="button" variant="outline" onClick={fill}>
              <Sparkles aria-hidden /> Fill
            </Button>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No periods yet. Use “Fill quickly” or add them one by one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5 font-medium">#</th>
                  <th className="p-1.5 font-medium">Starts</th>
                  <th className="p-1.5 font-medium">Ends</th>
                  <th className="p-1.5 font-medium">Name</th>
                  <th className="p-1.5 font-medium">Half day</th>
                  <th className="p-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const n = r.kind === "PERIOD" ? ++periodNo : null;
                  return (
                    <tr key={i} className={cn("border-t", r.kind === "BREAK" && "bg-highlight/10")}>
                      <td className="p-1.5 font-medium">{n ?? <Badge variant="outline">Break</Badge>}</td>
                      <td className="p-1.5">
                        <Input aria-label={`Row ${i + 1} starts`} type="time" className="h-8 w-28" disabled={!manage} value={r.start}
                          onChange={(e) => set(i, { start: e.target.value })} />
                      </td>
                      <td className="p-1.5">
                        <Input aria-label={`Row ${i + 1} ends`} type="time" className="h-8 w-28" disabled={!manage} value={r.end}
                          onChange={(e) => set(i, { end: e.target.value })} />
                      </td>
                      <td className="p-1.5">
                        <Input aria-label={`Row ${i + 1} name`} className="h-8 w-36" disabled={!manage} maxLength={40} value={r.label}
                          placeholder={r.kind === "BREAK" ? "Break" : `Period ${n}`} onChange={(e) => set(i, { label: e.target.value })} />
                      </td>
                      <td className="p-1.5">
                        <input type="checkbox" className="size-4 accent-primary" aria-label={`Row ${i + 1} on half days`}
                          disabled={!manage} checked={r.onHalfDay} onChange={(e) => set(i, { onHalfDay: e.target.checked })} />
                      </td>
                      <td className="p-1.5 text-right">
                        {manage && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Remove row ${i + 1}`}
                            onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                            <Trash2 aria-hidden />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => setRows((all) => [...all, { kind: "PERIOD", label: "", start: last, end: addMinutes(last, 40), onHalfDay: true }])}>
              <Plus aria-hidden /> Period
            </Button>
            <Button type="button" variant="outline" size="sm"
              onClick={() => setRows((all) => [...all, { kind: "BREAK", label: "Break", start: last, end: addMinutes(last, 30), onHalfDay: true }])}>
              <Plus aria-hidden /> Break
            </Button>
            <Button className="ms-auto" disabled={save.isPending || rows.length === 0} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save bell schedule"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- generator

function Generator({ yearId, bells }: { yearId: number; bells: BellSlot[] }) {
  const can = useCan();
  const manage = can(P.ACADEMICS_MANAGE);
  const queryClient = useQueryClient();
  const classes = useClasses();
  const sections = sectionOptions(classes.data);
  const { days } = useDays(yearId);
  const [scope, setScope] = useState<"ALL" | "SOME">("ALL");
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [proposal, setProposal] = useState<TimetableProposal | null>(null);
  const [viewing, setViewing] = useState<number | "">("");
  const [confirming, setConfirming] = useState(false);
  const generate = useMutation({
    mutationFn: () => teaching.generate(yearId, scope === "ALL" ? undefined : [...chosen]),
    onSuccess: (p) => {
      setProposal(p);
      setViewing(p.sections?.[0]?.sectionId ?? "");
    },
    onError,
  });
  const save = useMutation({
    mutationFn: () =>
      teaching.saveAll(
        yearId,
        (proposal?.sections ?? []).map((s) => ({
          sectionId: s.sectionId ?? 0,
          periods: (s.periods ?? []).map((p) => ({
            weekday: p.weekday,
            periodNo: p.periodNo,
            startTime: p.startTime,
            endTime: p.endTime,
            subjectId: p.subjectId,
            staffId: p.staffId,
            locked: p.locked,
          })),
        })),
      ),
    onSuccess: (r) => {
      toast.success(`Timetable saved: ${r.periods ?? 0} periods in ${proposal?.sections?.length ?? 0} sections`);
      setConfirming(false);
      setProposal(null);
      void queryClient.invalidateQueries({ queryKey: ["teaching", yearId, "timetable"] });
    },
    onError,
  });
  const periods = bells.filter((b) => b.kind === "PERIOD");
  const plan = proposal?.sections?.find((s) => s.sectionId === viewing);
  const sectionCount = proposal?.sections?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-5 text-primary" aria-hidden /> Auto-generate the timetable
        </CardTitle>
        <CardDescription>
          Uses each class&apos;s periods a week (Subjects &amp; marks), the subject teachers (Teachers by section), the working
          week and the bell schedule. No teacher is ever put in two places at once. Periods you have locked stay as they
          are. Nothing is saved until you check the result and press Save.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Make the timetable for</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tt-scope" checked={scope === "ALL"} onChange={() => setScope("ALL")} />
            The whole school (recommended: teachers are shared between classes)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tt-scope" checked={scope === "SOME"} onChange={() => setScope("SOME")} />
            Chosen sections only (the others stay as they are)
          </label>
          {scope === "SOME" && (
            <div className="ms-6 flex flex-wrap gap-x-4 gap-y-1.5">
              {sections.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={chosen.has(s.id)}
                    onChange={(e) =>
                      setChosen((c) => {
                        const next = new Set(c);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {manage && (
          <div>
            <Button disabled={generate.isPending || (scope === "SOME" && chosen.size === 0)} onClick={() => generate.mutate()}>
              <Wand2 aria-hidden /> {generate.isPending ? "Working it out…" : proposal ? "Generate again" : "Generate"}
            </Button>
          </div>
        )}

        {proposal && (
          <div className="flex flex-col gap-4 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3">
              {proposal.complete ? (
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2 aria-hidden /> Every period placed
                </Badge>
              ) : (
                <Badge className="bg-highlight text-highlight-foreground">
                  <AlertTriangle aria-hidden /> {proposal.placed} of {proposal.total} periods placed
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {sectionCount} {sectionCount === 1 ? "section" : "sections"} · {proposal.total} periods to place
              </span>
            </div>
            {(proposal.problems ?? []).length > 0 && (
              <Alert>
                <AlertTriangle aria-hidden />
                <AlertDescription>
                  <ul className="list-disc space-y-1 ps-4">
                    {(proposal.problems ?? []).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Field id="tt-preview" label="Preview section" className="max-w-xs">
              <NativeSelect id="tt-preview" value={viewing} onChange={(e) => setViewing(e.target.value ? Number(e.target.value) : "")}>
                {(proposal.sections ?? []).map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.sectionLabel}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {plan && <PreviewGrid periods={plan.periods ?? []} days={days} bellPeriods={periods} />}
            {manage && (
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={save.isPending || sectionCount === 0} onClick={() => setConfirming(true)}>
                  Save this timetable
                </Button>
                <span className="text-xs text-muted-foreground">You can still change any period by hand afterwards.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Replace the timetable?"
        description={`The timetable of ${sectionCount} ${sectionCount === 1 ? "section" : "sections"} is replaced by this one. Locked periods stay as they are.`}
        confirmLabel="Save timetable"
        pending={save.isPending}
        onConfirm={() => save.mutate()}
      />
    </Card>
  );
}

function PreviewGrid({ periods, days, bellPeriods }: { periods: Period[]; days: { name: string; weekday: number }[]; bellPeriods: BellSlot[] }) {
  const at = (weekday: number, n: number) => periods.find((p) => p.weekday === weekday && p.periodNo === n);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th scope="col" className="border-b p-2 text-left font-medium">Period</th>
            {days.map((d) => (
              <th key={d.weekday} scope="col" className="border-b p-2 text-left font-medium">
                {short(d.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bellPeriods.map((b) => (
            <tr key={b.periodNo} className="align-top">
              <th scope="row" className="border-b p-2 text-left font-normal">
                <div className="font-medium">{b.periodNo}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {hhmm(b.startTime)}–{hhmm(b.endTime)}
                </div>
              </th>
              {days.map((d) => {
                const p = at(d.weekday, b.periodNo ?? 0);
                return (
                  <td key={d.weekday} className={cn("border-b p-2", p?.locked && "bg-primary/5")}>
                    {p ? (
                      <>
                        <div className="flex items-center gap-1 font-medium">
                          {p.locked && <Lock className="size-3 text-primary" aria-label="Locked" />}
                          {p.subjectName ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.staffName ?? "No teacher"}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
