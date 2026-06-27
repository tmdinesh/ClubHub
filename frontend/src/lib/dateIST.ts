/**
 * IST date utilities — all datetimes in this app are entered and displayed in
 * Asia/Kolkata (IST = UTC+05:30) regardless of the browser's local timezone.
 */

const TZ = "Asia/Kolkata";

/** Convert a picker value "YYYY-MM-DDTHH:MM" (entered as IST) to a UTC ISO string
 *  with explicit +05:30 offset so the backend stores the correct instant. */
export function toISO(v: string): string | null {
  if (!v) return null;
  const base = v.length === 16 ? `${v}:00` : v;
  return `${base}+05:30`;
}

/** Parse a picker value as an IST instant, returning a JS Date (for preview). */
export function parsePickerIST(v: string): Date | null {
  if (!v) return null;
  try {
    return new Date(`${v.length === 16 ? `${v}:00` : v}+05:30`);
  } catch {
    return null;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function getParts(iso: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
}

function getLongMonthParts(iso: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
}

function pad(n: string) {
  return n.length === 1 ? `0${n}` : n;
}

// ── Public formatters ───────────────────────────────────────────────────────

/** "Wed, Jun 15 2026 · 2:30 PM" */
export function fmtDateTimeIST(iso: string): string {
  const p = getParts(iso);
  return `${p.weekday}, ${p.month} ${pad(p.day)} ${p.year} · ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "Jun 15, 2026 · 2:30 PM" */
export function fmtDateTimeMedIST(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${pad(p.day)}, ${p.year} · ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "Jun 15, 2026" */
export function fmtDateIST(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${pad(p.day)}, ${p.year}`;
}

/** "Jun 15 2026, 2:30 PM" (compact, used in registration windows) */
export function fmtDateTimeCompactIST(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${pad(p.day)} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "June 15, 2026" (long month name, used on certificates) */
export function fmtDateLongIST(iso: string): string {
  const p = getLongMonthParts(iso);
  return `${p.month} ${pad(p.day)}, ${p.year}`;
}

/** "Jun 15" */
export function fmtMonthDayIST(iso: string): string {
  const p = getParts(iso);
  return `${p.month} ${pad(p.day)}`;
}

/** "2:30 PM" */
export function fmtTimeIST(iso: string): string {
  const p = getParts(iso);
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** Convert a stored ISO/UTC string back to picker format "YYYY-MM-DDTHH:MM" in IST.
 *  Use this when pre-filling datetime pickers from existing event data. */
export function isoToPickerIST(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // en-CA gives "YYYY-MM-DD, HH:MM" — normalize to "YYYY-MM-DDTHH:MM"
  return f.format(d).replace(", ", "T").replace(/ /g, " ").slice(0, 16);
}

/** Preview string for the DateTimePicker (value is still in picker format, not ISO) */
export function previewIST(pickerVal: string): string {
  const d = parsePickerIST(pickerVal);
  if (!d || isNaN(d.getTime())) return "";
  return fmtDateTimeIST(d.toISOString());
}
