function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtPrice(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2).replace(".", ",");
}

export function fmtMoney(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
