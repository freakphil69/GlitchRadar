import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { storage } from "@/src/utils/storage";

export interface Settings {
  autoScan: boolean;
  scanIntervalMin: number;
  minDiscount: number;
  favShops: string[];
  favCategories: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  autoScan: true,
  scanIntervalMin: 30,
  minDiscount: 0,
  favShops: [],
  favCategories: [],
};

const KEY = "gr_settings_v1";

export async function loadSettings(): Promise<Settings> {
  const raw = await storage.getItem(KEY, "");
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(s: Settings): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(s));
}

export function useSettings(): Settings {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  return data ?? DEFAULT_SETTINGS;
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const cur = await loadSettings();
      await saveSettings({ ...cur, ...patch });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
