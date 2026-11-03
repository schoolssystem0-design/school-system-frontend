"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { school, type DayType, type WorkingWeek, type Year } from "@/lib/api/endpoints";
import { rollover } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";
import { useYear } from "@/features/shell/year-context";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** Academic years (FR 1.2), working days and holidays (FR 1.4). */
export function YearsPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const schoolId = me.data?.school?.id ?? 0;
  const yearsKey = ["school", schoolId, "years"];
  const years = useQuery({ queryKey: yearsKey, queryFn: school.years });
  const manage = can(me.data?.permissions, P.SCHOOL_YEAR_MANAGE);
  const calendar = can(me.data?.permissions, P.SCHOOL_CALENDAR_MANAGE);
  const [openingYear, setOpeningYear] = useState<Year | null>(null);
  const [rollingYear, setRollingYear] = useState<Year | null>(null);
  const { selected } = useYear();

  const makeCurrent = useMutation({
    mutationFn: (id: number) => school.makeCurrent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: yearsKey });
      setOpeningYear(null);
      toast.success("Academic year opened. The previous year is now closed.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (years.isPending) return <Loading />;
  if (years.isError) return <ErrorState error={years.error} onRetry={() => years.refetch()} />;
  const current = years.data.find((y) => y.status === "CURRENT");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academic years"
        description="Each year's admissions, fees, attendance and results are kept separately."
      />
      {manage && (
        <NewYearForm
          key={years.data.length}
          suggestedFrom={years.data[0]}
          onCreated={() => queryClient.invalidateQueries({ queryKey: yearsKey })}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {years.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No academic year yet">Create the current year to start using the system.</Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.data.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-medium">{y.name}</TableCell>
                    <TableCell>{formatDate(y.startDate)}</TableCell>
                    <TableCell>{formatDate(y.endDate)}</TableCell>
                    <TableCell>
                      <Badge variant={y.status === "CURRENT" ? "default" : y.status === "CLOSED" ? "secondary" : "outline"}>
                        {y.status === "CURRENT" ? "Current" : y.status === "CLOSED" ? "Closed" : "Upcoming"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {manage && y.status !== "CLOSED" && years.data.some((o) => (o.startDate ?? "") < (y.startDate ?? "")) && (
                        <Button size="sm" variant="outline" onClick={() => setRollingYear(y)}>
                          Copy from previous year
                        </Button>
                      )}
                      {manage && y.status === "UPCOMING" && (
                        <Button size="sm" variant="outline" onClick={() => setOpeningYear(y)}>
                          Make current
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && <CalendarCard year={selected} editable={calendar} />}

      {rollingYear && (
        <RolloverDialog
          to={rollingYear}
          earlier={years.data.filter((o) => (o.startDate ?? "") < (rollingYear.startDate ?? ""))}
          onClose={() => setRollingYear(null)}
        />
      )}

      <ConfirmDialog
        open={openingYear != null}
        onOpenChange={(open) => !open && setOpeningYear(null)}
        title={`Open ${openingYear?.name}?`}
        description={
          current
            ? `${current.name} will be closed and become read-only (authorised corrections only). New entries will be saved under ${openingYear?.name}.`
            : `New entries will be saved under ${openingYear?.name}.`
        }
        confirmLabel="Open year"
        pending={makeCurrent.isPending}
        onConfirm={() => openingYear?.id && makeCurrent.mutate(openingYear.id)}
      />
    </div>
  );
}

function NewYearForm({ suggestedFrom, onCreated }: { suggestedFrom?: Year; onCreated: () => void }) {
  const next = suggest(suggestedFrom);
  const [name, setName] = useState(next.name);
  const [startDate, setStart] = useState(next.start);
  const [endDate, setEnd] = useState(next.end);
  const create = useMutation({
    mutationFn: () => school.createYear({ name, startDate, endDate }),
    onSuccess: () => {
      onCreated();
      toast.success(`Academic year ${name} created`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>New academic year</CardTitle>
        <CardDescription>The working week is copied from the previous year.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field id="year-name" label="Name" hint="e.g. 2026-2027">
            <Input id="year-name" value={name} onChange={(e) => setName(e.target.value)} className="w-32" required />
          </Field>
          <Field id="year-start" label="Start date">
            <Input id="year-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field id="year-end" label="End date">
            <Input id="year-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            <Plus aria-hidden /> Create year
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Suggests the year after the latest one (April–March, common in Pakistani schools). */
function suggest(latest?: Year) {
  const s = latest?.endDate ? Number(latest.endDate.slice(0, 4)) : new Date().getFullYear();
  return { name: `${s}-${s + 1}`, start: `${s}-04-01`, end: `${s + 1}-03-31` };
}

function CalendarCard({ year, editable }: { year: Year; editable: boolean }) {
  const queryClient = useQueryClient();
  const yearId = year.id ?? 0;
  const locked = year.status === "CLOSED";
  const week = useQuery({ queryKey: ["school", "week", yearId], queryFn: () => school.week(yearId) });
  const daysOff = useQuery({ queryKey: ["school", "daysOff", yearId], queryFn: () => school.daysOff(yearId) });
  const [draft, setDraft] = useState<WorkingWeek | null>(null);
  const [holiday, setHoliday] = useState({ title: "", dateFrom: "", dateTo: "", type: "HOLIDAY" });

  const saveWeek = useMutation({
    mutationFn: (w: WorkingWeek) => school.saveWeek(yearId, w),
    onSuccess: (saved) => {
      queryClient.setQueryData(["school", "week", yearId], saved);
      setDraft(null);
      toast.success("Working days saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addHoliday = useMutation({
    mutationFn: () =>
      school.addDayOff(yearId, {
        title: holiday.title,
        dateFrom: holiday.dateFrom,
        dateTo: holiday.dateTo || holiday.dateFrom,
        type: holiday.type as "HOLIDAY" | "VACATION",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["school", "daysOff", yearId] });
      setHoliday({ title: "", dateFrom: "", dateTo: "", type: "HOLIDAY" });
      toast.success("Added to the calendar");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => school.removeDayOff(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "daysOff", yearId] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const shownWeek = draft ?? week.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>School calendar · {year.name}</CardTitle>
        <CardDescription>
          Attendance is only expected on working days; holidays and vacations are never counted as absences.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section aria-labelledby="week-title">
          <h2 id="week-title" className="mb-2 text-sm font-medium">
            Working week
          </h2>
          {shownWeek ? (
            <div className="flex flex-wrap items-end gap-3">
              {DAYS.map((day) => (
                <Field key={day} id={`day-${day}`} label={day.charAt(0) + day.slice(1).toLowerCase()}>
                  <NativeSelect
                    id={`day-${day}`}
                    className="w-24"
                    disabled={!editable}
                    value={shownWeek[day]}
                    onChange={(e) => setDraft({ ...shownWeek, [day]: e.target.value as DayType })}
                  >
                    <option value="FULL">Full day</option>
                    <option value="HALF">Half day</option>
                    <option value="OFF">Off</option>
                  </NativeSelect>
                </Field>
              ))}
              {editable && draft && (
                <Button onClick={() => saveWeek.mutate(draft)} disabled={saveWeek.isPending}>
                  Save working days
                </Button>
              )}
            </div>
          ) : (
            <Loading />
          )}
        </section>

        <section aria-labelledby="holidays-title" className="flex flex-col gap-3">
          <h2 id="holidays-title" className="text-sm font-medium">
            Holidays and vacations
          </h2>
          {editable && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addHoliday.mutate();
              }}
            >
              <Field id="h-title" label="Title">
                <Input id="h-title" value={holiday.title} required maxLength={200} placeholder="Summer vacation"
                  onChange={(e) => setHoliday((h) => ({ ...h, title: e.target.value }))} />
              </Field>
              <Field id="h-from" label="From">
                <Input id="h-from" type="date" required value={holiday.dateFrom} min={year.startDate} max={year.endDate}
                  onChange={(e) => setHoliday((h) => ({ ...h, dateFrom: e.target.value }))} />
              </Field>
              <Field id="h-to" label="To">
                <Input id="h-to" type="date" value={holiday.dateTo} min={holiday.dateFrom || year.startDate} max={year.endDate}
                  onChange={(e) => setHoliday((h) => ({ ...h, dateTo: e.target.value }))} />
              </Field>
              <Field id="h-type" label="Type">
                <NativeSelect id="h-type" className="w-32" value={holiday.type}
                  onChange={(e) => setHoliday((h) => ({ ...h, type: e.target.value }))}>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="VACATION">Vacation</option>
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={addHoliday.isPending}>
                <Plus aria-hidden /> Add
              </Button>
            </form>
          )}
          {daysOff.data && daysOff.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daysOff.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell>{formatDate(d.dateFrom)}</TableCell>
                    <TableCell>{formatDate(d.dateTo)}</TableCell>
                    <TableCell>{d.type === "VACATION" ? "Vacation" : "Holiday"}</TableCell>
                    <TableCell>
                      {editable && !locked && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.title}`}
                          onClick={() => d.id && remove.mutate(d.id)}>
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No holidays entered for this year.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/**
 * "Open a new year" helper (FR 1.3): copies the chosen set-up from an earlier year so nothing is typed again. The
 * earlier year is not changed. Students are moved separately under Students → Promotion.
 */
function RolloverDialog({ to, earlier, onClose }: { to: Year; earlier: Year[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const sorted = [...earlier].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const [fromYearId, setFromYearId] = useState<number>(sorted[0]?.id ?? 0);
  const options = useQuery({ queryKey: ["school", "rollover-options"], queryFn: rollover.options });
  const [chosen, setChosen] = useState<string[] | null>(null);
  const items = chosen ?? (options.data ?? []).map((o) => o.key ?? "");
  const run = useMutation({
    mutationFn: () => rollover.run(to.id ?? 0, { fromYearId, items }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries();
      const copied = Object.entries(r.copied ?? {});
      toast.success(copied.length ? `Copied: ${copied.map(([k, n]) => `${label(k)} (${n})`).join(", ")}` : "Nothing to copy");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Copy set-up into {to.name}</DialogTitle>
            <DialogDescription>
              The earlier year is not changed. Items already present in {to.name} are kept.
            </DialogDescription>
          </DialogHeader>
          <Field id="ro-from" label="Copy from">
            <NativeSelect id="ro-from" value={fromYearId} onChange={(e) => setFromYearId(Number(e.target.value))}>
              {sorted.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">What to copy</legend>
            {options.isPending ? (
              <Loading />
            ) : (
              (options.data ?? []).map((o) => (
                <label key={o.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={items.includes(o.key ?? "")}
                    onCheckedChange={(checked) =>
                      setChosen(checked ? [...items, o.key ?? ""] : items.filter((k) => k !== o.key))
                    }
                  />
                  {o.label}
                </label>
              ))
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={run.isPending || items.length === 0 || !fromYearId}>
              {run.isPending ? "Copying…" : "Copy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function label(key: string) {
  return key.charAt(0) + key.slice(1).toLowerCase().replaceAll("_", " ");
}
