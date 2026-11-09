import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { Age } from "@/src/components/Age";
import { Countdown } from "@/src/components/Countdown";
import { useToast } from "@/src/components/Toast";
import { fmtMoney, imgSrc } from "@/src/lib/format";
import { expiryUrgency } from "@/src/lib/expiry";
import { useIsStashed, useStashActions } from "@/src/lib/stash";
import { RISK_LABELS, TYPE_LABELS, type Glitch } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function GlitchCard({ glitch, index = 0 }: { glitch: Glitch; index?: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const stashed = useIsStashed(glitch.id);
  const actions = useStashActions();

  const riskColor =
    glitch.risk_level === "low" ? colors.success : glitch.risk_level === "medium" ? colors.warning : colors.error;
  const urgency = expiryUrgency(glitch);

  const onStash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stashed) {
      actions.remove.mutate(glitch.id);
      toast("Aus dem Stash entfernt", "info");
    } else {
      actions.save.mutate(glitch);
      toast("Im Stash gesichert", "success");
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 45, 360)).duration(250)}>
      <Pressable
        testID={`glitch-card-${glitch.id}`}
        onPress={() => router.push(`/glitch/${glitch.id}`)}
        style={({ pressed }) => [
          styles.card,
          urgency && styles.cardUrgent,
          pressed && { borderColor: colors.borderStrong },
        ]}
      >
        {urgency ? (
          <View style={styles.urgentBanner} testID={`glitch-expiry-${glitch.id}`}>
            <MaterialCommunityIcons name="timer-alert-outline" size={16} color={colors.error} />
            <Text style={styles.urgentText}>{urgency === "today" ? "LÄUFT HEUTE AB" : "LÄUFT MORGEN AB"}</Text>
          </View>
        ) : null}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[glitch.type]}</Text>
          </View>
          {glitch.temperature != null ? <Text style={styles.temp}>{glitch.temperature}°</Text> : null}
          <Text style={styles.shop} numberOfLines={1}>{glitch.shop}</Text>
          <View style={styles.riskRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={styles.riskText}>{RISK_LABELS[glitch.risk_level]} · ungeprüft</Text>
          </View>
        </View>

        <View style={styles.bodyRow}>
          {glitch.image_url ? (
            <Image source={{ uri: imgSrc(glitch.image_url) }} style={styles.thumb} contentFit="cover" transition={150} />
          ) : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title} numberOfLines={2}>
              {glitch.title}
            </Text>
            <Text style={styles.desc} numberOfLines={2}>
              {glitch.description}
            </Text>
          </View>
        </View>

        {glitch.glitched_price != null || glitch.discount_pct > 0 ? (
          <View style={styles.priceRow}>
            {glitch.glitched_price != null ? (
              <Text style={styles.priceGlitched}>{fmtMoney(glitch.glitched_price)}</Text>
            ) : null}
            {glitch.original_price != null ? (
              <Text style={styles.priceOriginal}>{fmtMoney(glitch.original_price)}</Text>
            ) : null}
            {glitch.discount_pct > 0 ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{glitch.discount_pct}%</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {glitch.min_order != null || glitch.valid_until ? (
          <View style={styles.termsRow} testID={`glitch-terms-${glitch.id}`}>
            {glitch.min_order != null ? (
              <View style={styles.termBox}>
                <Text style={styles.termLabel}>MINDESTBESTELLWERT</Text>
                <Text style={styles.termValue}>{fmtMoney(glitch.min_order)}</Text>
              </View>
            ) : null}
            {glitch.valid_until ? (
              <View style={[styles.termBox, urgency && styles.termBoxUrgent]}>
                <Text style={[styles.termLabel, urgency && { color: colors.error }]}>GÜLTIG BIS</Text>
                <Text style={styles.termValue}>{glitch.valid_until}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sourceLine} numberOfLines={1}>
          QUELLE · {glitch.source_label}
        </Text>

        <View style={styles.footerRow}>
          {glitch.expires_at ? <Countdown expiresAt={glitch.expires_at} /> : <Age publishedAt={glitch.published_at} />}
          {glitch.coupon_code ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{glitch.coupon_code}</Text>
            </View>
          ) : null}
          <Pressable
            testID={`glitch-stash-button-${glitch.id}`}
            onPress={(e) => {
              e.stopPropagation();
              onStash();
            }}
            style={[styles.stashBtn, stashed && styles.stashBtnActive]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={stashed ? "archive-check" : "archive-plus"}
              size={18}
              color={stashed ? colors.onBrandTertiary : colors.onSurfaceTertiary}
            />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bodyRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceTertiary,
  },
  termsRow: { flexDirection: "row", gap: spacing.sm },
  cardUrgent: { borderColor: c.error, borderWidth: 2 },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  urgentText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: c.error },
  termBoxUrgent: { borderColor: c.error, backgroundColor: c.surfaceSecondary },
  termBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    borderRadius: radius.sm,
    backgroundColor: c.brandTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  termLabel: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.2, color: c.onBrandTertiary },
  termValue: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface, marginTop: 2 },
  temp: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: c.brandPrimary,
  },
  sourceLine: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: c.muted,
  },
  typeBadge: {
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    color: c.onBrandTertiary,
  },
  shop: {
    fontSize: 12,
    fontFamily: fonts.text,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 10,
    fontFamily: fonts.mono,
    color: c.onSurfaceTertiary,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    color: c.onSurface,
  },
  desc: {
    fontSize: 13,
    fontFamily: fonts.textRegular,
    color: c.onSurfaceTertiary,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  priceGlitched: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    color: c.onSurface,
    fontVariant: ["tabular-nums"],
  },
  priceOriginal: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: c.muted,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: c.error,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: "auto",
  },
  discountText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: c.onError,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  codeBadge: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    height: 28,
    justifyContent: "center",
    flexShrink: 1,
  },
  codeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: c.onBrandTertiary,
    letterSpacing: 1,
  },
  stashBtn: {
    marginLeft: "auto",
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stashBtnActive: {
    borderColor: c.brandPrimary,
    backgroundColor: c.brandTertiary,
  },
}));
