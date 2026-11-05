import type { Glitch } from "./types";

// "dd.mm." or "dd.mm.yy(yy)" -> Date at end of that day. Without a year we assume the next occurrence.
export function parseValidUntil(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (!m) return null;
  const now = new Date();
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
  let d = new Date(year, Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  if (!m[3] && d.getTime() < now.getTime() - 30 * 86_400_000) {
    year += 1;
    d = new Date(year, Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  }
  return isNaN(d.getTime()) ? null : d;
}

/** "today" | "tomorrow" when the deal ends today/tomorrow, otherwise null. */
export function expiryUrgency(g: Pick<Glitch, "expires_at" | "valid_until">): "today" | "tomorrow" | null {
  const end = g.expires_at ? new Date(g.expires_at) : parseValidUntil(g.valid_until);
  if (!end) return null;
  const now = new Date();
  if (end.getTime() < now.getTime()) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((end.getTime() - startOfToday) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : null;
}
