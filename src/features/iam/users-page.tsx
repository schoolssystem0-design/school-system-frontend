"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { SecretOnce } from "@/components/app/secret-once";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { iam, type Role, type User } from "@/lib/api/endpoints";
import { formatDateTime } from "@/lib/format";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";
import { useStepUp } from "@/features/step-up/step-up-provider";

type StatusAction = { user: User; to: "ACTIVE" | "INACTIVE" };

/** School user accounts (FR 1.6, 1.7, 2.4, 2.5). Passwords are never shown; resets issue a temporary one. */
export function UsersPage() {
  const me = useMe();
  const manage = can(me.data?.permissions, P.IAM_USER_MANAGE);
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const users = useQuery({ queryKey: ["iam", "users", q, status, page], queryFn: () => iam.users({ q, status, page }) });
  const roles = useQuery({ queryKey: ["iam", "roles"], queryFn: iam.roles });
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [secret, setSecret] = useState<Schemas["TemporaryPassword"] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const changeStatus = useMutation({
    mutationFn: ({ user, to, reason }: StatusAction & { reason: string }) =>
      guard(() => (to === "INACTIVE" ? iam.deactivate(user.id ?? 0, reason) : iam.activate(user.id ?? 0, reason))),
    onSuccess: (u) => {
      setStatusAction(null);
      void refresh();
      toast.success(u.status === "INACTIVE" ? `${u.displayName} can no longer sign in` : `${u.displayName} activated`);
    },
    onError,
  });
  const unlock = useMutation({
    mutationFn: (u: User) => guard(() => iam.unlock(u.id ?? 0)),
    onSuccess: () => {
      void refresh();
      toast.success("Account unlocked");
    },
    onError,
  });
  const reset = useMutation({
    mutationFn: (u: User) => guard(() => iam.resetPassword(u.id ?? 0)),
    onSuccess: (result) => setSecret(result),
    onError,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Every person signs in with their own account; roles decide what they can see and do."
        actions={
          manage && (
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add user
            </Button>
          )
        }
      />
      {secret && (
        <SecretOnce
          title={`Temporary password for ${secret.username}`}
          value={secret.temporaryPassword ?? ""}
          note="Give it to the user privately. It is shown only once and must be changed at first sign-in."
        />
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field id="user-search" label="Search">
          <Input id="user-search" value={q} placeholder="Name, username or email" className="w-64"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }} />
        </Field>
        <Field id="user-status" label="Status">
          <NativeSelect id="user-status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </NativeSelect>
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {users.isPending ? (
            <Loading />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => users.refetch()} />
          ) : users.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No users found" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  {manage && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.displayName}
                      {u.mainAdmin && <Badge variant="outline" className="ms-2">Main admin</Badge>}
                    </TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell className="max-w-56 truncate">{(u.roles ?? []).map((r) => r.name).join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>
                        {u.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                      {u.locked && <Badge variant="destructive" className="ms-1">Locked</Badge>}
                    </TableCell>
                    <TableCell>{formatDateTime(u.lastLoginAt)}</TableCell>
                    {manage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${u.displayName}`} />}>
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(u)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => reset.mutate(u)}>Reset password</DropdownMenuItem>
                            {u.locked && <DropdownMenuItem onClick={() => unlock.mutate(u)}>Unlock</DropdownMenuItem>}
                            {!u.mainAdmin && (
                              <DropdownMenuItem
                                variant={u.status === "ACTIVE" ? "destructive" : "default"}
                                onClick={() => setStatusAction({ user: u, to: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                              >
                                {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {users.data && users.data.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          Page {page + 1} of {users.data.totalPages}
          <Button size="sm" variant="outline" disabled={page + 1 >= users.data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {editing && roles.data && (
        <UserDialog
          user={editing === "new" ? null : editing}
          roles={roles.data}
          onClose={() => setEditing(null)}
          onCreated={(result) => setSecret(result)}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={statusAction != null}
        onOpenChange={(open) => !open && setStatusAction(null)}
        title={statusAction?.to === "INACTIVE" ? `Deactivate ${statusAction.user.displayName}?` : `Activate ${statusAction?.user.displayName}?`}
        description={
          statusAction?.to === "INACTIVE"
            ? "They are signed out at once and cannot sign in. Their history stays in all records."
            : "They will be able to sign in again."
        }
        confirmLabel={statusAction?.to === "INACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusAction?.to === "INACTIVE"}
        requireReason
        pending={changeStatus.isPending}
        onConfirm={(reason) => statusAction && changeStatus.mutate({ ...statusAction, reason })}
      />
    </div>
  );
}

function UserDialog({
  user,
  roles,
  onClose,
  onCreated,
  onSaved,
}: {
  user: User | null;
  roles: Role[];
  onClose: () => void;
  onCreated: (r: Schemas["TemporaryPassword"]) => void;
  onSaved: () => void;
}) {
  const guard = useStepUp();
  const [form, setForm] = useState({
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    dataScope: (user?.dataScope ?? "ALL") as "ALL" | "ASSIGNED_CLASSES" | "SELF",
  });
  const [roleIds, setRoleIds] = useState<number[]>((user?.roles ?? []).map((r) => r.id ?? 0));
  const save = useMutation({
    mutationFn: () =>
      guard(async () => {
        if (user) {
          await iam.updateUser(user.id ?? 0, {
            displayName: form.displayName,
            email: form.email || undefined,
            phone: form.phone || undefined,
            dataScope: form.dataScope,
            roleIds,
            version: user.version ?? 0,
          });
          return null;
        }
        return iam.createUser({ ...form, email: form.email || undefined, phone: form.phone || undefined, roleIds });
      }),
    onSuccess: (created) => {
      onSaved();
      if (created) onCreated(created);
      toast.success(user ? "User saved" : "User created");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{user ? `Edit ${user.displayName}` : "Add user"}</DialogTitle>
            {!user && <DialogDescription>A temporary password is created and shown once.</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="u-name" label="Full name">
              <Input id="u-name" required maxLength={200} value={form.displayName} onChange={set("displayName")} />
            </Field>
            <Field id="u-username" label="Username" hint={user ? "Cannot be changed" : "lowercase, e.g. ahmed.khan"}>
              <Input id="u-username" required disabled={!!user} maxLength={60} value={form.username} onChange={set("username")} />
            </Field>
            <Field id="u-email" label="Email" hint="Needed for verification codes and password resets">
              <Input id="u-email" type="email" maxLength={254} value={form.email} onChange={set("email")} />
            </Field>
            <Field id="u-phone" label="Phone">
              <Input id="u-phone" maxLength={30} value={form.phone} onChange={set("phone")} />
            </Field>
            <Field id="u-scope" label="Can see" className="sm:col-span-2">
              <NativeSelect id="u-scope" value={form.dataScope} onChange={set("dataScope")}>
                <option value="ALL">All classes</option>
                <option value="ASSIGNED_CLASSES">Only assigned classes (teachers)</option>
                <option value="SELF">Only own records</option>
              </NativeSelect>
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Roles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(r.id ?? 0)}
                    onCheckedChange={(checked) =>
                      setRoleIds((ids) => (checked ? [...ids, r.id ?? 0] : ids.filter((x) => x !== r.id)))
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || roleIds.length === 0}>
              {save.isPending ? "Saving…" : user ? "Save" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
