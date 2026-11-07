"use client";

import { School } from "lucide-react";
import { useState } from "react";
import { API_BASE_URL, fileUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Two-letter initials for a name. */
export function initialsOf(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/** A person's photo in a circle; their initials when there is no photo (or it fails to load). */
export function UserAvatar({
  name,
  photoFileId,
  className,
}: {
  name?: string | null;
  photoFileId?: number | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<number | null>(null);
  const src = photoFileId != null && failed !== photoFileId ? fileUrl(photoFileId) : null;
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-highlight text-xs font-semibold text-highlight-foreground",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not optimisable
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(photoFileId ?? null)} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/**
 * The school's logo on a white tile (logos are designed for light backgrounds); a school icon when there is none.
 * {@code src} wins over {@code logoFileId} (the sign-in page uses the public logo address).
 */
export function SchoolLogo({
  logoFileId,
  src: explicitSrc,
  className,
  iconClassName,
  onMissing,
}: {
  logoFileId?: number | null;
  src?: string | null;
  className?: string;
  iconClassName?: string;
  onMissing?: () => void;
}) {
  const wanted = explicitSrc ?? (logoFileId != null ? fileUrl(logoFileId) : null);
  const [failed, setFailed] = useState<string | null>(null);
  const src = wanted && failed !== wanted ? wanted : null;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        src ? "bg-white p-1 ring-1 ring-black/5" : "bg-primary text-white shadow-lg shadow-primary/40",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- school logo from the API
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          onError={() => {
            setFailed(src);
            onMissing?.();
          }}
        />
      ) : (
        <School className={cn("size-5", iconClassName)} />
      )}
    </span>
  );
}

/** The public logo address of a school (sign-in page, no session). */
export function publicLogoUrl(schoolCode: string) {
  const code = schoolCode.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code) ? `${API_BASE_URL}/public/schools/${encodeURIComponent(code)}/logo` : null;
}
