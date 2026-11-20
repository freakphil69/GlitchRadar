import { filterAllowed, isAllowedOffer } from "./offerPolicy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "./api";
import type { AlarmGlitch, Facets, Glitch, Scan, ScanResult, Stats } from "./types";

export interface GlitchFilters {
  type: string;
  sort: string;
  minDiscount: number;
  shops: string[];
  categories: string[];
  q?: string;
}

export function useGlitches(filters: GlitchFilters) {
  return useQuery({
    queryKey: ["glitches", filters],
    select: (rows) => filterAllowed(rows),
    queryFn: () =>
      apiGet<Glitch[]>(
        `/glitches?type=${filters.type}&sort=${filters.sort}&min_discount=${filters.minDiscount}` +
          `&shops=${encodeURIComponent(filters.shops.join(","))}` +
          `&categories=${encodeURIComponent(filters.categories.join(","))}` +
          `&q=${encodeURIComponent(filters.q ?? "")}`,
      ),
    refetchInterval: 30_000,
  });
}

export function useAlarm() {
  return useQuery({
    queryKey: ["alarm"],
    select: (rows) => filterAllowed(rows),
    queryFn: () => apiGet<AlarmGlitch[]>("/alarm"),
    refetchInterval: 30_000,
  });
}

export function useFacets() {
  return useQuery({ queryKey: ["facets"], queryFn: () => apiGet<Facets>("/facets") });
}

export function useCodes(shop: string) {
  return useQuery({
    queryKey: ["codes", shop],
    select: (rows) => filterAllowed(rows),
    queryFn: () => apiGet<Glitch[]>(`/codes?shop=${encodeURIComponent(shop)}`),
    refetchInterval: 60_000,
  });
}

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, up }: { id: string; up: boolean }) => apiPost<Glitch>(`/glitches/${id}/vote`, { up }),
    onSuccess: (g) => {
      qc.setQueryData(["glitch", g.id], g);
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
  });
}

export function useGlitch(id: string) {
  return useQuery({
    queryKey: ["glitch", id],
    select: (offer) => { if (!isAllowedOffer(offer)) throw new Error("Dieses Angebot ist aufgrund der Inhaltsrichtlinie ausgeblendet."); return offer; },
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
