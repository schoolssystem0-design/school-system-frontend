"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { families, students, type Family } from "@/lib/api/people";
import { P } from "@/lib/permissions";
import { label, useCan } from "@/features/people/shared";
import { FamilyFees } from "@/features/fees/student-fees";
import { familyBody, FamilyForm, familyFrom } from "./family-form";

export function FamilyDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const family = useQuery({ queryKey: ["families", id], queryFn: () => families.get(id) });
  if (family.isPending) return <Loading />;
  if (family.isError) return <ErrorState error={family.error} onRetry={() => family.refetch()} />;
  return <FamilyView key={family.data.version} family={family.data} />;
}

function FamilyView({ family }: { family: Family }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const id = family.id ?? 0;
  const [value, setValue] = useState(familyFrom(family.details));
  const children = useQuery({
    queryKey: ["students", "family", id],
    queryFn: () => students.list({ familyId: id, status: "ALL", size: 50 }),
    enabled: can(P.STUDENTS_VIEW),
  });
  const save = useMutation({
    mutationFn: () => families.update(id, { ...familyBody(value), version: family.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success("Family saved. The change applies to all children of this family.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const manage = can(P.FAMILIES_MANAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Family ${family.familyNo}`}
        description={[family.details?.fatherName, family.details?.motherName].filter(Boolean).join(" & ")}
        actions={
          <Button variant="outline" render={<Link href="/app/families" />}>
            All families
          </Button>
        }
      />
      {family.contactsHidden && (
        <Alert>
          <AlertDescription>Phone numbers, CNIC and address are hidden for your role.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Parents and contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset disabled={!manage} className="contents">
              <FamilyForm idPrefix="fam" value={value} onChange={setValue} contactsHidden={family.contactsHidden} />
            </fieldset>
            {manage && (
              <div>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save family"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      {can(P.FEES_VIEW) && <FamilyFees familyId={id} />}
      {can(P.STUDENTS_VIEW) && (
        <Card>
          <CardHeader>
            <CardTitle>Children</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {children.isPending ? (
              <Loading />
            ) : children.isError ? (
              <ErrorState error={children.error} />
            ) : children.data.items.length === 0 ? (
              <div className="p-6">
                <Empty title="No children linked to this family" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GR no.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {children.data.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.grNo}</TableCell>
                      <TableCell>
                        <Link className="font-medium underline-offset-4 hover:underline" href={`/app/students/${s.id}`}>
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>{s.className ? `${s.className} - ${s.sectionName}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{label(s.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
