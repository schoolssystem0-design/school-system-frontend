"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { academics, type SchoolClass } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";

const KEY = ["academics", "classes"];

/** Classes and sections (FR 9.2, 9.3, 9.7). Classes are listed youngest to oldest everywhere. */
export function ClassesPage() {
  const me = useMe();
  const manage = can(me.data?.permissions, P.ACADEMICS_MANAGE);
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: KEY, queryFn: academics.classes });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const [name, setName] = useState("");
  const [grading, setGrading] = useState<"MARKS" | "GRADES">("MARKS");
  const create = useMutation({
    mutationFn: () => academics.createClass({ name, gradingMode: grading }),
    onSuccess: () => {
      setName("");
      void refresh();
    },
    onError,
  });
  const reorder = useMutation({
    mutationFn: academics.reorder,
    onSuccess: (list) => queryClient.setQueryData(KEY, list),
    onError,
  });

  if (classes.isPending) return <Loading />;
  if (classes.isError) return <ErrorState error={classes.error} onRetry={() => classes.refetch()} />;
  const list = classes.data;

  function move(index: number, delta: number) {
    const ids = list.map((c) => c.id ?? 0);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    reorder.mutate(ids);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Classes & sections"
        description="Create classes from the youngest to the oldest and add sections where a class is divided."
      />
      {manage && (
        <Card>
          <CardContent className="pt-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <Field id="class-name" label="New class">
                <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 1" required maxLength={60} />
              </Field>
              <Field id="class-grading" label="Results shown as">
                <NativeSelect id="class-grading" className="w-40" value={grading}
                  onChange={(e) => setGrading(e.target.value as "MARKS" | "GRADES")}>
                  <option value="MARKS">Marks</option>
                  <option value="GRADES">Grades only</option>
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={create.isPending}>
                <Plus aria-hidden /> Add class
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {list.length === 0 ? (
        <Empty title="No classes yet">Add Play Group, Nursery, Class 1… in order.</Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((c, i) => (
            <li key={c.id}>
              <ClassCard
                schoolClass={c}
                manage={manage}
                first={i === 0}
                last={i === list.length - 1}
                onMove={(d) => move(i, d)}
                onChanged={refresh}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ClassCard({
  schoolClass: c,
  manage,
  first,
  last,
  onMove,
  onChanged,
}: {
  schoolClass: SchoolClass;
  manage: boolean;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  onChanged: () => void;
}) {
  const [section, setSection] = useState("");
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const id = c.id ?? 0;
  const addSection = useMutation({
    mutationFn: () => academics.createSection(id, section),
    onSuccess: () => {
      setSection("");
      onChanged();
    },
    onError,
  });
  const status = useMutation({
    mutationFn: (s: "ACTIVE" | "INACTIVE") => academics.classStatus(id, s),
    onSuccess: onChanged,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => academics.deleteClass(id),
    onSuccess: () => {
      toast.success(`${c.name} deleted`);
      onChanged();
    },
    onError,
  });
  const sectionAction = useMutation({
    mutationFn: async ({ sectionId, action }: { sectionId: number; action: "delete" | "ACTIVE" | "INACTIVE" }) => {
      if (action === "delete") await academics.deleteSection(sectionId);
      else await academics.sectionStatus(sectionId, action);
    },
    onSuccess: onChanged,
    onError,
  });
  const inactive = c.status === "INACTIVE";

  return (
    <Card className={inactive ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {c.name}
          <span className="text-sm font-normal text-muted-foreground">({c.shortName})</span>
          {c.gradingMode === "GRADES" && <Badge variant="outline">Grades only</Badge>}
          {inactive && <Badge variant="secondary">Inactive</Badge>}
        </CardTitle>
        {manage && (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" disabled={first} aria-label={`Move ${c.name} up`} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden />
            </Button>
            <Button size="icon-sm" variant="ghost" disabled={last} aria-label={`Move ${c.name} down`} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden />
            </Button>
            <Button size="sm" variant="outline" onClick={() => status.mutate(inactive ? "ACTIVE" : "INACTIVE")}>
              {inactive ? "Activate" : "Deactivate"}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => remove.mutate()}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Sections:</span>
        {(c.sections ?? []).length === 0 && <span className="text-sm text-muted-foreground">none</span>}
        {(c.sections ?? []).map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm">
            {s.name}
            {s.status === "INACTIVE" && <span className="text-xs text-muted-foreground">(inactive)</span>}
            {manage && (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove section ${s.name}`}
                onClick={() => s.id && sectionAction.mutate({ sectionId: s.id, action: "delete" })}
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            )}
          </span>
        ))}
        {manage && (
          <form
            className="ms-auto flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSection.mutate();
            }}
          >
            <Input
              aria-label={`New section for ${c.name}`}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="A"
              className="w-20"
              maxLength={30}
              required
            />
            <Button size="sm" type="submit" variant="outline" disabled={addSection.isPending}>
              Add section
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
