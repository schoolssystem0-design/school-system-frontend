/** Display formatting. Times are shown in the school's timezone (Asia/Karachi). */
const ZONE = "Asia/Karachi";

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : ZONE,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONE,
  }).format(new Date(value));
}

/** Money arrives from the API as a string ("3500.00"); shown as Rs. 3,500. */
export function formatMoney(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const [whole, fraction] = value.split(".");
  const grouped = Number(whole).toLocaleString("en-PK");
  return fraction && fraction !== "00" ? `Rs. ${grouped}.${fraction}` : `Rs. ${grouped}`;
}
