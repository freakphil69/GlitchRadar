import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { Countdown } from "@/src/components/Countdown";
import { fmtPrice } from "@/src/lib/format";
import { useAlarm } from "@/src/lib/queries";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Loud banner for glitches that live less than 15 minutes (expiring or brand-new price errors).
export function GlitchAlarm() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const alarm = useAlarm();
  const glow = useSharedValue(1);

  const items = alarm.data ?? [];

  useEffect(() => {
    glow.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  if (items.length === 0) return null;

  return (
    <View testID="glitch-alarm" style={styles.box}>
      <View style={styles.head}>
        <Animated.View style={[styles.dot, glowStyle]} />
        <Text style={styles.headText}>GLITCH-ALARM · {items.length} AKTIV</Text>
        <MaterialCommunityIcons name="alarm-light" size={18} color={colors.error} />
      </View>
      <Text style={styles.sub}>Jetzt zuschlagen – diese Funde sind in unter 15 Minuten weg.</Text>
      {items.slice(0, 3).map((g) => (
        <Pressable
          key={g.id}
          testID={`glitch-alarm-item-${g.id}`}
          onPress={() => router.push(`/glitch/${g.id}`)}
          style={styles.item}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.reason}>{g.alarm_reason === "expiring" ? "LÄUFT AB" : "NEUER PREISFEHLER"}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {g.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {g.shop}
              {g.glitched_price != null ? ` · ${fmtPrice(g.glitched_price)} €` : ""}
              {g.discount_pct > 0 ? ` · -${g.discount_pct} %` : ""}
            </Text>
          </View>
          <Countdown expiresAt={g.alarm_deadline} />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    borderWidth: 1,
    borderColor: c.error,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.error },
  headText: { flex: 1, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: c.error },
  sub: { fontFamily: fonts.textRegular, fontSize: 12, color: c.onSurfaceTertiary },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.divider,
    paddingTop: spacing.sm,
    minHeight: 44,
  },
  reason: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, color: c.warning },
  title: { fontFamily: fonts.text, fontSize: 14, color: c.onSurface },
  meta: { fontFamily: fonts.textRegular, fontSize: 12, color: c.muted },
}));
