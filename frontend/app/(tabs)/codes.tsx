import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Age } from "@/src/components/Age";
import { ChipRow } from "@/src/components/ChipRow";
import { useToast } from "@/src/components/Toast";
import { useCodes, useVote } from "@/src/lib/queries";
import type { Glitch } from "@/src/lib/types";
import { usesNativeTabs } from "@/src/navigation";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const VOTED_KEY = "gr_voted_v1";

export default function CodesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [shop, setShop] = useState("all");
  const all = useCodes("all");
  const list = useCodes(shop);
  const vote = useVote();
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useMemo(() => {
    storage.getItem(VOTED_KEY, "").then((raw) => {
      if (raw) {
        try {
          setVoted(JSON.parse(raw));
        } catch {
          // ignore broken local cache
        }
      }
    });
  }, []);

  const shopChips = useMemo(() => {
    const shops = Array.from(new Set((all.data ?? []).map((g) => g.shop))).slice(0, 12);
    return [{ key: "all", label: "ALLE SHOPS" }, ...shops.map((s) => ({ key: s, label: s.toUpperCase() }))];
  }, [all.data]);

  const copy = async (g: Glitch) => {
    if (!g.coupon_code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(g.coupon_code);
    toast(`Code ${g.coupon_code} kopiert`, "success");
  };

  const onVote = (g: Glitch, up: boolean) => {
    if (voted[g.id] !== undefined) {
      toast("Du hast schon abgestimmt", "info");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { ...voted, [g.id]: up };
    setVoted(next);
    storage.setItem(VOTED_KEY, JSON.stringify(next));
    vote.mutate({ id: g.id, up });
    toast(up ? "Danke! Code funktioniert" : "Gemeldet: Code geht nicht", up ? "success" : "info");
  };

  const codes = list.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + 12 }}>
        <Text style={styles.title}>CODE-VAULT</Text>
        <Text style={styles.subtitle}>Echte Gutscheincodes aus Live-Quellen. Antippen zum Kopieren.</Text>
        <ChipRow options={shopChips} value={shop} onChange={setShop} />
      </View>

      <FlatList
        data={codes}
        keyExtractor={(g) => g.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomChrome + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching && !list.isLoading} onRefresh={list.refetch} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.stateBox} testID="codes-loading">
              <ActivityIndicator color={colors.brandPrimary} size="large" />
            </View>
          ) : list.isError ? (
            <View style={styles.stateBox} testID="codes-error">
              <MaterialCommunityIcons name="wifi-off" size={40} color={colors.error} />
              <Text style={styles.stateTitle}>UPLINK VERLOREN</Text>
              <Pressable testID="codes-retry-button" onPress={() => list.refetch()} style={styles.retryBtn}>
                <Text style={styles.retryText}>ERNEUT VERSUCHEN</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stateBox} testID="codes-empty">
              <MaterialCommunityIcons name="ticket-outline" size={40} color={colors.muted} />
              <Text style={styles.stateTitle}>GERADE KEINE CODES</Text>
              <Text style={styles.stateText}>Der Server prüft alle 10 Minuten neue Quellen.</Text>
            </View>
          )
        }
        renderItem={({ item: g }) => {
          const total = g.votes_up + g.votes_down;
          const rate = total ? Math.round((g.votes_up / total) * 100) : null;
          const myVote = voted[g.id];
          return (
            <View style={styles.card} testID={`code-card-${g.id}`}>
              <Pressable onPress={() => router.push(`/glitch/${g.id}`)} style={{ gap: 4 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.shop} numberOfLines={1}>
                    {g.shop}
                  </Text>
                  {g.discount_pct > 0 ? <Text style={styles.pct}>-{g.discount_pct}%</Text> : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {g.title}
                </Text>
              </Pressable>

              <Pressable testID={`code-copy-${g.id}`} onPress={() => copy(g)} style={styles.codeBox}>
                <Text style={styles.codeText}>{g.coupon_code}</Text>
                <MaterialCommunityIcons name="content-copy" size={18} color={colors.onBrandTertiary} />
              </Pressable>

              <View style={styles.rowBottom}>
                <Age publishedAt={g.published_at} />
                <Text style={styles.rate}>{rate == null ? "NOCH KEINE STIMMEN" : `${rate}% KLAPPT · ${total}`}</Text>
                <Pressable
                  testID={`code-vote-up-${g.id}`}
                  onPress={() => onVote(g, true)}
                  style={[styles.voteBtn, myVote === true && { borderColor: colors.success, backgroundColor: colors.success + "22" }]}
                  hitSlop={4}
                >
                  <MaterialCommunityIcons name="thumb-up-outline" size={16} color={colors.success} />
                </Pressable>
                <Pressable
                  testID={`code-vote-down-${g.id}`}
                  onPress={() => onVote(g, false)}
                  style={[styles.voteBtn, myVote === false && { borderColor: colors.error, backgroundColor: colors.error + "22" }]}
                  hitSlop={4}
                >
                  <MaterialCommunityIcons name="thumb-down-outline" size={16} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    color: c.onSurface,
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontFamily: fonts.textRegular,
    fontSize: 13,
    color: c.muted,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
  },
  listContent: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  shop: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 12,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pct: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: c.onError,
    backgroundColor: c.error,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, color: c.onSurface },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.borderStrong,
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  codeText: { fontFamily: fonts.mono, fontSize: 18, letterSpacing: 2, color: c.onBrandTertiary },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rate: { flex: 1, fontFamily: fonts.mono, fontSize: 10, color: c.onSurfaceTertiary, letterSpacing: 0.5 },
  voteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBox: { alignItems: "center", gap: spacing.sm, paddingVertical: 64, paddingHorizontal: spacing.xl },
  stateTitle: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface, letterSpacing: 1, marginTop: spacing.sm },
  stateText: { fontSize: 13, fontFamily: fonts.textRegular, color: c.muted, textAlign: "center", lineHeight: 19 },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: c.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: c.onBrandPrimary, fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1 },
}));
