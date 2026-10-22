import { storage } from "@/src/utils/storage";

// Free users get a few manual scans per day; PRO (verified RevenueCat entitlement) is unlimited.
// The server still scans in the background every 10 minutes for everyone.
export const FREE_SCANS_PER_DAY = 3;
const KEY = "gr_scan_quota_v1";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function scansUsedToday(): Promise<number> {
  const raw = await storage.getItem(KEY, "");
  if (!raw) return 0;
  try {
    const q = JSON.parse(raw) as { date: string; count: number };
    return q.date === today() ? q.count : 0;
  } catch {
    return 0;
  }
}

export async function recordScan(): Promise<void> {
  const used = await scansUsedToday();
  await storage.setItem(KEY, JSON.stringify({ date: today(), count: used + 1 }));
}
