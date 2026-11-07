"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/app/avatars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meQueryKey, type Me } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { iam, school } from "@/lib/api/endpoints";

/** Upload, replace or remove a photo: used for your own photo and, by administrators, for other users. */
export function PhotoPicker({
  name,
  photoFileId,
  onSave,
  saving,
}: {
  name?: string | null;
  photoFileId?: number | null;
  onSave: (fileId: number | null) => void;
  saving?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const inputId = `photo-${useId()}`;
  const busy = uploading || saving;
  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} photoFileId={photoFileId} className="size-20 text-xl" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={busy || undefined}
          >
            <Camera className="size-4" aria-hidden /> {uploading ? "Uploading…" : photoFileId ? "Change photo" : "Upload photo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("The photo must be 5 MB or smaller");
                return;
              }
              setUploading(true);
              try {
                const saved = await school.upload("USER_PHOTO", file);
                onSave(saved.id ?? null);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setUploading(false);
              }
            }}
          />
          {photoFileId != null && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onSave(null)}>
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 5 MB. A square photo looks best.</p>
      </div>
    </div>
  );
}

/** The signed-in user's own profile photo. */
export function ProfilePhotoDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (fileId: number | null) => iam.myPhoto(fileId),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["iam"] });
      toast.success(r.photoFileId ? "Profile photo saved" : "Profile photo removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your profile photo</DialogTitle>
          <DialogDescription>Shown next to your name at the top of every page and in the list of users.</DialogDescription>
        </DialogHeader>
        <PhotoPicker name={me.displayName} photoFileId={me.photoFileId} saving={save.isPending} onSave={(id) => save.mutate(id)} />
      </DialogContent>
    </Dialog>
  );
}
