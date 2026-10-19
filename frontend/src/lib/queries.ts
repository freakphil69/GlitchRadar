import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";
import type { Glitch, Scan, ScanResult, Stats } from "./types";

export interface GlitchFilters {
  type: string;
  sort: string;
  minDiscount: number;
}

export function useGlitches(filters: GlitchFilters) {
  return useQuery({
    queryKey: ["glitches", filters],
    queryFn: () =>
      apiGet<Glitch[]>(`/glitches?type=${filters.type}&sort=${filters.sort}&min_discount=${filters.minDiscount}`),
    refetchInterval: 30_000,
  });
}

export function useGlitch(id: string) {
  return useQuery({
    queryKey: ["glitch", id],
    queryFn: () => apiGet<Glitch>(`/glitches/${id}`),
    enabled: !!id,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<Stats>("/stats"),
    refetchInterval: 30_000,
  });
}

export function useRecentScans() {
  return useQuery({
    queryKey: ["scans"],
    queryFn: () => apiGet<Scan[]>("/scans/recent"),
    refetchInterval: 15_000,
  });
}

export function useScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<ScanResult>("/scan", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glitches"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
    },
  });
}

export function useEnrich(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Glitch>(`/glitches/${id}/enrich`, {}),
    onSuccess: (g) => {
      qc.setQueryData(["glitch", id], g);
      qc.invalidateQueries({ queryKey: ["glitches"] });
    },
  });
}

export function useReportDead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ ok: boolean }>(`/glitches/${id}/report-dead`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glitches"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
    },
  });
}
