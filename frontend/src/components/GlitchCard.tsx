import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { Countdown } from "@/src/components/Countdown";
import { useToast } from "@/src/components/Toast";
import { fmtMoney } from "@/src/lib/format";
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
        style={({ pressed }) => [styles.card, pressed && { borderColor: colors.borderStrong }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[glitch.type]}</Text>
          </View>
          <Text style={styles.shop}>{glitch.shop}</Text>
          <View style={styles.riskRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={styles.riskText}>{RISK_LABELS[glitch.risk_level]} · {glitch.success_rate}%</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {glitch.title}
        </Text>

        <Text style={styles.desc} numberOfLines={2}>
          {glitch.description}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceGlitched}>{fmtMoney(glitch.glitched_price)}</Text>
          <Text style={styles.priceOriginal}>{fmtMoney(glitch.original_price)}</Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{glitch.discount_pct}%</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Countdown expiresAt={glitch.expires_at} />
          {glitch.coupon_code ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{glitch.coupon_code}</Text>
            </View>
          ) : null}
          <Pressable
            testID={`glitch-stash-button-${glitch.id}`}
            onPress={onStash}
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
