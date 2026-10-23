import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { storage } from "@/src/utils/storage";
import { apiGet, apiPut, getAuthToken } from "./api";
import type { Glitch } from "./types";

// Stash = local watchlist + claimed ledger. Snapshots are stored because glitches
// expire server-side; the snapshot keeps the price delta for the savings counter.
export interface StashItem {
  glitch: Glitch;
  savedAt: string;
  claimed: boolean;
}

const KEY = "gr_stash_v1";

export async function loadStash(): Promise<StashItem[]> {
  const raw = await storage.getItem(KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveStash(items: StashItem[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(items));
  // Logged-in users get the stash mirrored to their account (best effort, offline-safe).
  if (getAuthToken()) apiPut("/stash", { items }).catch(() => {});
}

// Merge local + account stash after login: union by glitch id, a claimed entry wins.
export async function syncStash(): Promise<void> {
  const remote = (await apiGet<{ items: StashItem[] }>("/stash")).items ?? [];
  const local = await loadStash();
  const merged = new Map<string, StashItem>();
  for (const it of [...remote, ...local]) {
    const prev = merged.get(it.glitch.id);
    if (!prev || (it.claimed && !prev.claimed)) merged.set(it.glitch.id, it);
  }
  const items = Array.from(merged.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  await saveStash(items);
}

export function useStash() {
  return useQuery({ queryKey: ["stash"], queryFn: loadStash });
}

export function useIsStashed(id: string | undefined) {
  const { data } = useQuery({ queryKey: ["stash"], queryFn: loadStash });
  return !!id && !!data?.some((i) => i.glitch.id === id);
}

export function useStashActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["stash"] });

  const save = useMutation({
    mutationFn: async (g: Glitch) => {
      const items = await loadStash();
      if (items.some((i) => i.glitch.id === g.id)) return;
      await saveStash([{ glitch: g, savedAt: new Date().toISOString(), claimed: false }, ...items]);
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const items = await loadStash();
      await saveStash(items.filter((i) => i.glitch.id !== id));
    },
    onSuccess: done,
  });

  const toggleClaim = useMutation({
    mutationFn: async (id: string) => {
      const items = await loadStash();
      await saveStash(items.map((i) => (i.glitch.id === id ? { ...i, claimed: !i.claimed } : i)));
    },
    onSuccess: done,
  });

  const clear = useMutation({
    mutationFn: async () => {
      await saveStash([]);
    },
    onSuccess: done,
  });

  return { save, remove, toggleClaim, clear };
}
