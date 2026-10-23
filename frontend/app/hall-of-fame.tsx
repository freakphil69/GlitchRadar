import { ActivityIndicator, FlatList, Pressable, RefreshControl, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { apiGet } from "@/src/lib/api";
import { fmtDateTime, fmtMoney } from "@/src/lib/format";
import type { Glitch } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type FameEntry = Glitch & { saving: number };

function headline(g: FameEntry): string {
  if (g.saving > 0 && g.glitched_price != null && g.original_price != null) {
    return `${fmtMoney(g.glitched_price)} statt ${fmtMoney(g.original_price)}`;
  }
  return g.discount_pct > 0 ? `-${g.discount_pct}%` : "Preisfehler";
}

export default function HallOfFameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const q = useQuery({ queryKey: ["hall-of-fame"], queryFn: () => apiGet<FameEntry[]>("/hall-of-fame?limit=25") });
  const entries = q.data ?? [];

  const share = async (list: FameEntry[]) => {
    const lines = list
      .slice(0, 3)
      .map((g, i) => `${i + 1}. ${g.title} (${g.shop}) – ${headline(g)}`)
      .join("\n");
    try {
      await Share.share({
        message: `GLITCHRADAR HALL OF FAME – die krassesten echten Preisfehler:\n${lines}\n\nHol dir die App und sei schneller als der Patch!`,
      });
    } catch {
      toast("Teilen fehlgeschlagen", "error");
    }
  };

  const medal = (i: number) => (i === 0 ? colors.warning : i === 1 ? colors.onSurfaceSecondary : i === 2 ? colors.brandSecondary : colors.muted);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="hof-back-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>HALL OF FAME</Text>
          <Text style={styles.subtitle}>Die größten echten Preisfehler, die das Radar je erfasst hat</Text>
        </View>
        <Pressable
          testID="hof-share-button"
          onPress={() => share(entries)}
          disabled={entries.length === 0}
          style={[styles.iconBtn, { borderColor: colors.brandPrimary }, entries.length === 0 && { opacity: 0.4 }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="share-variant" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brand} />}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 48 }} testID="hof-loading" />
          ) : (
            <View style={styles.empty} testID="hof-empty">
              <MaterialCommunityIcons name="trophy-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>
                {q.isError ? "Konnte nicht geladen werden." : "Noch keine Rekorde – das Radar sammelt weiter."}
              </Text>
            </View>
          )
        }
        renderItem={({ item: g, index }) => (
          <Pressable testID={`hof-entry-${index}`} onPress={() => router.push(`/glitch/${g.id}`)} style={styles.row}>
            <Text style={[styles.rank, { color: medal(index) }]}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {g.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {g.shop} · {fmtDateTime(g.published_at)} · {g.source_label}
              </Text>
              <Text style={styles.rowHead}>{headline(g)}</Text>
            </View>
            {g.saving > 0 ? <Text style={styles.saving}>+{fmtMoney(g.saving)}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: c.onSurface, letterSpacing: 1 },
  subtitle: { fontFamily: fonts.textRegular, fontSize: 12, color: c.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rank: { width: 32, fontFamily: fonts.displayBold, fontSize: 28, textAlign: "center" },
  rowTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 20, color: c.onSurface },
  rowMeta: { fontFamily: fonts.mono, fontSize: 10, color: c.muted },
  rowHead: { fontFamily: fonts.mono, fontSize: 12, color: c.onBrandTertiary },
  saving: { fontFamily: fonts.displayBold, fontSize: 18, color: c.success },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: 64 },
  emptyText: { fontFamily: fonts.textRegular, fontSize: 13, color: c.muted, textAlign: "center" },
}));
