import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipRow } from "@/src/components/ChipRow";
import { GlitchCard } from "@/src/components/GlitchCard";
import { Ticker } from "@/src/components/Ticker";
import { useGlitches, useStats } from "@/src/lib/queries";
import { useSettings } from "@/src/lib/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TYPE_CHIPS = [
  { key: "all", label: "ALLE" },
  { key: "price_error", label: "PREISFEHLER" },
  { key: "coupon", label: "GUTSCHEINE" },
  { key: "cashback", label: "CASHBACK" },
  { key: "shipping", label: "VERSAND" },
  { key: "stack", label: "STAPEL" },
];

const SORT_CHIPS = [
  { key: "ending", label: "LÄUFT BALD" },
  { key: "new", label: "NEUESTE" },
  { key: "discount", label: "MAX RABATT" },
  { key: "risk", label: "TREFFERQUOTE" },
];

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const settings = useSettings();

  const [type, setType] = useState("all");
  const [sort, setSort] = useState("ending");

  const filters = useMemo(
    () => ({ type, sort, minDiscount: settings.minDiscount }),
    [type, sort, settings.minDiscount],
  );
  const list = useGlitches(filters);
  const stats = useStats();

  const glitches = list.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
        <Ticker
          activeCount={stats.data?.active_count}
          savings={stats.data?.total_savings_potential}
          lastScanAt={stats.data?.last_scan?.finished_at ?? stats.data?.last_scan?.started_at ?? null}
        />
        <ChipRow options={TYPE_CHIPS} value={type} onChange={setType} />
        <ChipRow options={SORT_CHIPS} value={sort} onChange={setSort} />
      </View>

      <FlatList
        data={glitches}
        keyExtractor={(g) => g.id}
        renderItem={({ item, index }) => <GlitchCard glitch={item} index={index} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isLoading}
            onRefresh={list.refetch}
            tintColor={colors.brand}
          />
        }
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.stateBox} testID="feed-loading">
              <ActivityIndicator color={colors.brandPrimary} size="large" />
              <Text style={styles.stateTitle}>SCANNER-STREAM LÄUFT…</Text>
              <Text style={styles.stateText}>Signale werden abgefangen.</Text>
            </View>
          ) : list.isError ? (
            <View style={styles.stateBox} testID="feed-error">
              <MaterialCommunityIcons name="wifi-off" size={40} color={colors.error} />
              <Text style={styles.stateTitle}>UPLINK VERLOREN</Text>
              <Text style={styles.stateText}>{(list.error as Error)?.message ?? "Verbindungsproblem."}</Text>
              <Pressable testID="error-retry-button" onPress={list.refetch} style={styles.stateButton}>
                <Text style={styles.stateButtonText}>ERNEUT VERSUCHEN</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stateBox} testID="feed-empty">
              <MaterialCommunityIcons name="radar" size={40} color={colors.muted} />
              <Text style={styles.stateTitle}>KEINE SIGNALE IM RADAR</Text>
              <Text style={styles.stateText}>Löse einen Scout-Scan aus oder passe die Filter an.</Text>
              <Pressable
                testID="empty-scan-button"
                onPress={() => router.push("/scout")}
                style={styles.stateButton}
              >
                <Text style={styles.stateButtonText}>SCOUT SENDEN</Text>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.surface,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  stateBox: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 64,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: c.onSurface,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  stateText: {
    fontSize: 13,
    fontFamily: fonts.textRegular,
    color: c.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  stateButton: {
    marginTop: spacing.md,
    backgroundColor: c.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stateButtonText: {
    color: c.onBrandPrimary,
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
  },
}));
