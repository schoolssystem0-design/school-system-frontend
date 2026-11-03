"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { iam, type PermissionDefinition, type Role } from "@/lib/api/endpoints";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";
import { useStepUp } from "@/features/step-up/step-up-provider";

/** Roles and what they allow (FR 1.7, 2.5). Changes apply to users on their next action. */
export function RolesPage() {
  const me = useMe();
  const manage = can(me.data?.permissions, P.IAM_ROLE_MANAGE);
  const roles = useQuery({ queryKey: ["iam", "roles"], queryFn: iam.roles });
  const permissions = useQuery({ queryKey: ["iam", "permissions"], queryFn: iam.permissions });
  const [editing, setEditing] = useState<Role | "new" | null>(null);

  if (roles.isPending || permissions.isPending) return <Loading />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => roles.refetch()} />;
  if (permissions.isError) return <ErrorState error={permissions.error} />;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Roles & permissions"
        description="Staff see only what their job requires. The API checks every request."
        actions={
          manage && (
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> New role
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {roles.data.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {r.name}
                {r.systemRole && <Badge variant="outline">Built-in</Badge>}
              </CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {r.administrator ? "Every permission" : `${r.permissions?.length ?? 0} permissions`} · {r.userCount} user
                {r.userCount === 1 ? "" : "s"}
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                {manage && !r.administrator ? "Edit" : "View"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          catalogue={permissions.data}
          editable={manage && !(editing !== "new" && editing.administrator)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RoleDialog({
  role,
  catalogue,
  editable,
  onClose,
}: {
  role: Role | null;
  catalogue: PermissionDefinition[];
  editable: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const guard = useStepUp();
  const [name, setName] = useState(role?.name ?? "");
  const [code, setCode] = useState(role?.code ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const groups = useMemo(() => {
    const map = new Map<string, PermissionDefinition[]>();
    for (const p of catalogue) map.set(p.group ?? "", [...(map.get(p.group ?? "") ?? []), p]);
    return [...map.entries()];
  }, [catalogue]);

  const save = useMutation({
    mutationFn: () =>
      guard(() =>
        role
          ? iam.updateRole(role.id ?? 0, { name, description, permissions: [...selected] })
          : iam.createRole({ code, name, description, permissions: [...selected] }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "roles"] });
      toast.success("Role saved");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => guard(() => iam.deleteRole(role?.id ?? 0)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "roles"] });
      toast.success("Role deleted");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{role ? role.name : "New role"}</DialogTitle>
          </DialogHeader>
          <fieldset disabled={!editable} className="contents">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="r-name" label="Name">
                <Input id="r-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field id="r-code" label="Code" hint={role ? undefined : "Capital letters, e.g. COORDINATOR"}>
                <Input id="r-code" required disabled={!!role} maxLength={40} value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </Field>
              <Field id="r-desc" label="Description" className="sm:col-span-2">
                <Input id="r-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            {groups.map(([group, items]) => (
              <fieldset key={group} className="rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">{group}</legend>
                <div className="flex flex-col gap-2">
                  {items.map((p) => (
                    <label key={p.code} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={role?.administrator || selected.has(p.code ?? "")}
                        onCheckedChange={(checked) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (checked) next.add(p.code ?? "");
                            else next.delete(p.code ?? "");
                            return next;
                          })
                        }
                      />
                      <span>
                        {p.description}
                        <span className="block text-xs text-muted-foreground">{p.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </fieldset>
          <DialogFooter>
            {editable && role && !role.systemRole && (
              <Button type="button" variant="destructive" className="me-auto" onClick={() => remove.mutate()}>
                Delete role
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {editable ? "Cancel" : "Close"}
            </Button>
            {editable && (
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save role"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
