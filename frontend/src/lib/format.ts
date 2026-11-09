import { Platform } from "react-native";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Browsers block mydealz images (CORP same-origin); native apps load them directly.
const IMG_HOSTS = [
  "static.mydealz.de",
  "www.dealdoktor.de",
  "dealdoktor.de",
  "static.preisjaeger.at",
  "www.mytopdeals.net",
  "mytopdeals.net",
  "www.sparhamster.at",
  "sparhamster.at",
];

// Proxy through our server on web (CORP headers) and whenever a small thumbnail (w) is wanted.
export function imgSrc(url: string, w?: number): string {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  const proxyOk = IMG_HOSTS.includes(host);
  if (!proxyOk || (Platform.OS !== "web" && !w)) return url;
  return `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/img?u=${encodeURIComponent(url)}${w ? `&w=${w}` : ""}`;
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
