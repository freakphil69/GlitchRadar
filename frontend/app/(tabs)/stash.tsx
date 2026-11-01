import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Age } from "@/src/components/Age";
import { ChipRow } from "@/src/components/ChipRow";
import { Countdown } from "@/src/components/Countdown";
import { useToast } from "@/src/components/Toast";
import { fmtMoney } from "@/src/lib/format";
import { useStash, useStashActions } from "@/src/lib/stash";
import { savingOf, TYPE_LABELS } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function StashScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const stash = useStash();
  const actions = useStashActions();

  const [tab, setTab] = useState("watch");

  const items = stash.data ?? [];
  const watch = items.filter((i) => !i.claimed);
  const claimed = items.filter((i) => i.claimed);
  const shown = tab === "watch" ? watch : claimed;
  const potential = watch.reduce((s, i) => s + savingOf(i.glitch), 0);
  const realized = claimed.reduce((s, i) => s + savingOf(i.glitch), 0);

  const onClaim = (id: string, claimedNow: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    actions.toggleClaim.mutate(id);
    toast(claimedNow ? "Aus gesichert zurückgesetzt" : "Als gesichert markiert — eingepreist!", "success");
  };

  const onRemove = (id: string) => {
    actions.remove.mutate(id);
    toast("Aus dem Stash entfernt", "info");
  };

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + 12 }}>
        <Text style={styles.title}>STASH</Text>
        <Text style={styles.subtitle}>Dein Glitch-Ledger — beobachten, zuschlagen, einstreichen.</Text>

        <View style={styles.summary}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>POTENZIELL</Text>
            <Text testID="stash-potential" style={styles.summaryValue}>
              {fmtMoney(potential)}
            </Text>
            <Text style={styles.summarySub}>{watch.length} beobachtet</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>EINGESTRICHEN</Text>
            <Text testID="stash-realized" style={[styles.summaryValue, { color: colors.success }]}>
              {fmtMoney(realized)}
            </Text>
            <Text style={styles.summarySub}>{claimed.length} gesichert</Text>
          </View>
        </View>

        <Pressable
          testID="stash-share-button"
          onPress={() => router.push("/share-savings")}
          disabled={items.length === 0}
          style={[styles.shareBtn, items.length === 0 && { opacity: 0.4 }]}
        >
          <MaterialCommunityIcons name="share-variant" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.shareText}>
            {realized > 0 ? `${fmtMoney(realized)} GESPART — TEILEN` : "MEINE FUNDE TEILEN"}
          </Text>
        </Pressable>

        <ChipRow
          options={[
            { key: "watch", label: `BEOBACHTET (${watch.length})` },
            { key: "claimed", label: `GESICHERT (${claimed.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(i) => i.glitch.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.stateBox} testID="stash-empty">
            <MaterialCommunityIcons name="archive-outline" size={40} color={colors.muted} />
            <Text style={styles.stateTitle}>{tab === "watch" ? "STASH LEER" : "NOCH NICHTS EINGESTRICHEN"}</Text>
            <Text style={styles.stateText}>
              {tab === "watch"
                ? "Sichere Signale aus dem Radar, um sie im Auge zu behalten."
                : "Markiere beobachtete Glitches als gesichert, sobald du zugeschlagen hast."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const g = item.glitch;
          const stillActive = g.expires_at ? new Date(g.expires_at).getTime() > Date.now() : true;
          return (
            <View style={styles.item} testID={`stash-item-${g.id}`}>
              <Pressable style={{ flex: 1, gap: 4 }} onPress={() => router.push(`/glitch/${g.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.itemShop}>{g.shop}</Text>
                  <Text style={styles.itemType}>{TYPE_LABELS[g.type]}</Text>
                </View>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {g.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
                  {savingOf(g) > 0 ? <Text style={styles.itemDelta}>+{fmtMoney(savingOf(g))}</Text> : null}
                  {!stillActive ? (
                    <Text style={styles.itemExpired}>ABGELAUFEN</Text>
                  ) : g.expires_at ? (
                    <Countdown expiresAt={g.expires_at} />
                  ) : g.published_at ? (
                    <Age publishedAt={g.published_at} />
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.itemActions}>
                <Pressable
                  testID={`stash-claim-${g.id}`}
                  onPress={() => onClaim(g.id, item.claimed)}
                  style={[styles.iconBtn, item.claimed && { backgroundColor: colors.success, borderColor: colors.success }]}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons
                    name="check-bold"
                    size={16}
                    color={item.claimed ? colors.onSuccess : colors.onSurfaceTertiary}
                  />
                </Pressable>
                <Pressable
                  testID={`stash-remove-${g.id}`}
                  onPress={() => onRemove(g.id)}
                  style={styles.iconBtn}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error} />
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
  screen: {
    flex: 1,
    backgroundColor: c.surface,
  },
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
    marginBottom: spacing.lg,
  },
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  summaryCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  vDivider: {
    width: 1,
    backgroundColor: c.divider,
  },
  summaryLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.muted,
  },
  summaryValue: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: c.onSurface,
    fontVariant: ["tabular-nums"],
  },
  summarySub: {
    fontFamily: fonts.textRegular,
    fontSize: 11,
    color: c.onSurfaceTertiary,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
  },
  shareText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.2,
    color: c.onBrandPrimary,
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemShop: {
    fontSize: 11,
    fontFamily: fonts.text,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemType: {
    fontSize: 9,
    fontFamily: fonts.mono,
    color: c.onBrandTertiary,
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 21,
    color: c.onSurface,
  },
  itemDelta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: c.success,
  },
  itemExpired: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: c.muted,
    letterSpacing: 0.5,
  },
  itemActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
