import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RadarSweep } from "@/src/components/RadarSweep";
import { useToast } from "@/src/components/Toast";
import { fmtClock, fmtDateTime, fmtMoney } from "@/src/lib/format";
import { useRecentScans, useScan, useStats } from "@/src/lib/queries";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SCAN_LOG_LINES = [
  "VERBINDE MIT SCOUT-KI (GPT 5.6 TERRA)…",
  "PROTOKOLL RADAR-7 AKTIVIERT…",
  "SCANNE 12.482 SHOP-ENDPUNKTE…",
  "HORCHE IN KASSEN-SYSTEME…",
  "PRÜFE GUTSCHEIN-ENGINE AUF DRIFT…",
  "GEMINI 3 FLASH: RISIKO-BEWERTUNG LÄUFT…",
  "FILTERE TOTE SIGNALE HERAUS…",
  "VERGLEICHE MIT BEKANNTEM MUSTER-MEMORY…",
];

export default function ScoutScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const scan = useScan();
  const scans = useRecentScans();
  const stats = useStats();
  const [log, setLog] = useState<string[]>(["SCOUT BEREIT — WARTE AUF BEFEHL."]);

  useEffect(() => {
    if (!scan.isPending) return;
    let i = 0;
    const t = setInterval(() => {
      setLog((prev) => [...prev.slice(-40), SCAN_LOG_LINES[i % SCAN_LOG_LINES.length]]);
      i += 1;
    }, 1300);
    return () => clearInterval(t);
  }, [scan.isPending]);

  const runScan = async () => {
    if (scan.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLog((prev) => [...prev.slice(-40), "BEFEHL ERHALTEN — SCOUT WIRD GESENDET…"]);
    try {
      const res = await scan.mutateAsync();
      setLog((prev) => [...prev.slice(-40), `SCAN ABGESCHLOSSEN — ${res.glitches.length} NEUE SIGNALE ERFASST.`]);
      toast(`${res.glitches.length} neue Glitches im Radar`, "success");
    } catch (e) {
      setLog((prev) => [...prev.slice(-40), `FEHLER: ${(e as Error).message}`]);
      toast("Scan fehlgeschlagen", "error");
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI SCOUT</Text>
          <Text style={styles.subtitle}>Autonomer Glitch-Crawler · GPT 5.6 TERRA + GEMINI 3 FLASH</Text>
        </View>

        <View style={styles.radarWrap}>
          <RadarSweep size={230} active={scan.isPending} />
          <Text style={styles.radarStatus}>
            {scan.isPending ? "SCANNE NETZWERK…" : scan.isError ? "SCOUT FEHLER" : "BEREIT"}
          </Text>
        </View>

        <Pressable
          testID="scout-start-button"
          onPress={runScan}
          disabled={scan.isPending}
          style={[styles.scanButton, scan.isPending && { opacity: 0.6 }]}
        >
          <Text style={styles.scanButtonText}>
            {scan.isPending ? "SCANNER LÄUFT…" : "SCAN STARTEN"}
          </Text>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>LETZTER SCAN</Text>
            <Text style={styles.statValue}>
              {stats.data?.last_scan?.started_at ? fmtClock(stats.data.last_scan.started_at) : "—"}
            </Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>FUNDE GESAMT</Text>
            <Text style={styles.statValue}>{stats.data?.total_found ?? "—"}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Σ POTENZIAL</Text>
            <Text style={[styles.statValue, { color: colors.brandPrimary }]}>
              {stats.data ? fmtMoney(stats.data.total_savings_potential) : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TERMINAL-LOG</Text>
        <View style={styles.terminal}>
          {log.slice(-7).map((line, idx) => (
            <Text key={`${idx}-${line}`} style={styles.terminalLine}>
              {`> ${line}`}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionTitle}>SCAN-PROTOKOLL</Text>
        <View style={styles.history}>
          {(scans.data ?? []).length === 0 ? (
            <Text style={styles.historyEmpty}>Keine Scans aufgezeichnet.</Text>
          ) : (
            (scans.data ?? []).map((s) => (
              <View key={s.id} style={styles.scanRow} testID="scan-history-row">
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        s.status === "done"
                          ? colors.success
                          : s.status === "failed"
                            ? colors.error
                            : colors.warning,
                    },
                  ]}
                />
                <Text style={styles.scanRowTime}>{fmtDateTime(s.started_at)}</Text>
                <Text style={styles.scanRowInfo}>{s.found_count} FUNDE</Text>
                <Text style={styles.scanRowSavings}>{fmtMoney(s.total_savings)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    color: c.onSurface,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: c.muted,
    letterSpacing: 0.5,
  },
  radarWrap: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  radarStatus: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: c.onSurfaceSecondary,
  },
  scanButton: {
    marginHorizontal: spacing.lg,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    color: c.onBrandPrimary,
    fontFamily: fonts.mono,
    fontSize: 15,
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  vDivider: {
    width: 1,
    backgroundColor: c.divider,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: c.muted,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: c.onSurface,
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: c.muted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  terminal: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    height: 168,
    justifyContent: "flex-end",
    gap: 2,
  },
  terminalLine: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 17,
    color: c.onSurfaceTertiary,
  },
  history: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  historyEmpty: {
    fontFamily: fonts.textRegular,
    fontSize: 13,
    color: c.muted,
    padding: spacing.sm,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanRowTime: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: c.onSurfaceSecondary,
  },
  scanRowInfo: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: c.onSurfaceTertiary,
    marginLeft: "auto",
  },
  scanRowSavings: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: c.brandPrimary,
    width: 76,
    textAlign: "right",
  },
}));
