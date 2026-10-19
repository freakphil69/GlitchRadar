import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/src/lib/api";
import { loadSettings } from "@/src/lib/settings";
import type { Scan } from "@/src/lib/types";

// Fires a scout scan once per app start when the last scan is older than the
// configured interval and auto-scan is enabled in settings.
export function AutoScan() {
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const settings = await loadSettings();
        if (!settings.autoScan) return;
        const scans = await apiGet<Scan[]>("/scans/recent");
        const last = scans?.[0];
        if (last) {
          if (last.status === "running") return;
          const ageMin = (Date.now() - new Date(last.started_at).getTime()) / 60000;
          if (ageMin < settings.scanIntervalMin) return;
        }
        await apiPost("/scan", {});
        qc.invalidateQueries({ queryKey: ["glitches"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        qc.invalidateQueries({ queryKey: ["scans"] });
      } catch {
        // auto-scan is best effort
      }
    })();
  }, [qc]);

  return null;
}
