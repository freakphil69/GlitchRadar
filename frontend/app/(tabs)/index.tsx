import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipRow } from "@/src/components/ChipRow";
import { GlitchAlarm } from "@/src/components/GlitchAlarm";
import { GlitchCard } from "@/src/components/GlitchCard";
import { POPULAR_SEARCHES, useRecentSearches } from "@/src/lib/recentSearches";
import { Ticker } from "@/src/components/Ticker";
import { useGlitches, useStats } from "@/src/lib/queries";
import { useSettings } from "@/src/lib/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TYPE_CHIPS = [
  { key: "all", label: "ALLE" },
  { key: "delivery", label: "LIEFERDIENSTE" },
  { key: "price_error", label: "PREISFEHLER" },
  { key: "coupon", label: "GUTSCHEINE" },
  { key: "stack", label: "STAPEL" },
  { key: "cashback", label: "CASHBACK" },
  { key: "shipping", label: "VERSAND" },
  { key: "deal", label: "DEALS" },
];

const SORT_CHIPS = [
  { key: "new", label: "NEUESTE" },
  { key: "hot", label: "HOT °" },
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
  const [sort, setSort] = useState("new");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  const searching = q.length > 0;
  const [searchFocused, setSearchFocused] = useState(false);
  const recentSearches = useRecentSearches();
  const addRecent = recentSearches.add;

  // Remember a term once the user has stopped typing for a moment.
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => addRecent(q), 1500);
    return () => clearTimeout(t);
  }, [q, addRecent]);

  const pickSearch = (term: string) => {
    setSearch(term);
    setQ(term);
    addRecent(term);
    setSearchFocused(false);
  };

  // Direct product search ignores the favourites filter so nothing gets hidden.
  const filters = useMemo(
    () => ({
      type,
      sort,
      minDiscount: settings.minDiscount,
      shops: searching ? [] : settings.favShops,
      categories: searching ? [] : settings.favCategories,
      q,
    }),
    [type, sort, settings.minDiscount, settings.favShops, settings.favCategories, q, searching],
  );
  const favCount = settings.favShops.length + settings.favCategories.length;
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
          onScan={() => router.push("/scout")}
        />
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput
            testID="radar-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Produkt suchen, z. B. AirPods, PS5, Dyson"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            onSubmitEditing={() => {
              setQ(search.trim());
              addRecent(search);
            }}
          />
          {search ? (
            <Pressable testID="radar-search-clear" onPress={() => setSearch("")} hitSlop={10} style={styles.searchClear}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {searchFocused && !search ? (
          <View style={styles.suggestBox} testID="search-suggestions">
            {recentSearches.recent.length > 0 ? (
              <>
                <View style={styles.suggestHead}>
                  <Text style={styles.suggestTitle}>ZULETZT GESUCHT</Text>
                  <Pressable testID="search-recent-clear" onPress={recentSearches.clear} hitSlop={8}>
                    <Text style={styles.suggestClear}>LÖSCHEN</Text>
                  </Pressable>
                </View>
                <View style={styles.suggestWrap}>
                  {recentSearches.recent.map((t) => (
                    <Pressable key={t} testID={`search-recent-${t}`} onPress={() => pickSearch(t)} style={styles.suggestChip}>
                      <MaterialCommunityIcons name="history" size={14} color={colors.muted} />
                      <Text style={styles.suggestText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={[styles.suggestTitle, { marginTop: spacing.xs }]}>BELIEBT</Text>
            <View style={styles.suggestWrap}>
              {POPULAR_SEARCHES.map((t) => (
                <Pressable key={t} testID={`search-popular-${t}`} onPress={() => pickSearch(t)} style={styles.suggestChip}>
                  <MaterialCommunityIcons name="trending-up" size={14} color={colors.brandPrimary} />
                  <Text style={styles.suggestText}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <ChipRow options={TYPE_CHIPS} value={type} onChange={setType} />
        <ChipRow options={SORT_CHIPS} value={sort} onChange={setSort} />
      </View>

      <FlatList
        data={glitches}
        keyExtractor={(g) => g.id}
        renderItem={({ item, index }) => <GlitchCard glitch={item} index={index} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          searching ? (
            <Text testID="radar-search-summary" style={styles.searchSummary}>
              {list.isFetching ? "SUCHE LÄUFT…" : `${glitches.length} TREFFER FÜR „${q.toUpperCase()}“`}
            </Text>
          ) : (
          <View style={{ gap: spacing.md }}>
            <GlitchAlarm />
            <Pressable testID="radar-hof-banner" onPress={() => router.push("/hall-of-fame")} style={styles.hofBanner}>
              <MaterialCommunityIcons name="trophy" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.hofTitle}>HALL OF FAME</Text>
                <Text style={styles.hofText}>Die krassesten echten Preisfehler aller Zeiten</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <Pressable testID="radar-favorites-filter" onPress={() => router.push("/favorites")} style={styles.favRow}>
              <MaterialCommunityIcons
                name={favCount > 0 ? "filter-check" : "filter-outline"}
                size={18}
                color={favCount > 0 ? colors.brandPrimary : colors.muted}
              />
              <Text style={[styles.favText, favCount > 0 && { color: colors.brandPrimary }]} numberOfLines={1}>
                {favCount > 0
                  ? `NUR MEINE FAVORITEN · ${settings.favShops.length} SHOPS · ${settings.favCategories.length} KATEGORIEN`
                  : "LIEBLINGS-SHOPS & KATEGORIEN WÄHLEN"}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </View>
          )
        }
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
              <Pressable testID="error-retry-button" onPress={() => list.refetch()} style={styles.stateButton}>
                <Text style={styles.stateButtonText}>ERNEUT VERSUCHEN</Text>
              </Pressable>
            </View>
          ) : searching ? (
            <View style={styles.stateBox} testID="search-empty">
              <MaterialCommunityIcons name="magnify-close" size={40} color={colors.muted} />
              <Text style={styles.stateTitle}>KEIN GLITCH GEFUNDEN</Text>
              <Text style={styles.stateText}>
                Gerade kein aktiver Deal für „{q}“. Schau direkt in der Community nach oder versuch es später erneut.
              </Text>
              <Pressable
                testID="search-mydealz-button"
                onPress={() => Linking.openURL(`https://www.mydealz.de/search?q=${encodeURIComponent(q)}`)}
                style={styles.stateButton}
              >
                <Text style={styles.stateButtonText}>BEI MYDEALZ SUCHEN</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stateBox} testID="feed-empty">
              <MaterialCommunityIcons name="radar" size={40} color={colors.muted} />
              <Text style={styles.stateTitle}>KEINE SIGNALE IM RADAR</Text>
              <Text style={styles.stateText}>
                {favCount > 0
                  ? "Gerade nichts bei deinen Lieblings-Shops. Passe die Auswahl an oder warte auf den nächsten Scan."
                  : "Löse einen Scout-Scan aus oder passe die Filter an."}
              </Text>
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
  hofBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.warning,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, height: 48, color: c.onSurface, fontFamily: fonts.text, fontSize: 15 },
  searchClear: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  searchSummary: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: c.muted },
  suggestBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceSecondary,
  },
  suggestHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  suggestTitle: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: c.muted },
  suggestClear: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: c.brandPrimary },
  suggestWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  suggestText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceSecondary },
  favRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: c.surfaceSecondary,
  },
  favText: { flex: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: c.onSurfaceTertiary },
  hofTitle: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: c.warning },
  hofText: { fontFamily: fonts.textRegular, fontSize: 12, color: c.onSurfaceTertiary },
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
