import { useEffect, useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { Countdown } from "@/src/components/Countdown";
import { fmtPrice } from "@/src/lib/format";
import { useAlarm } from "@/src/lib/queries";
import { useSettings } from "@/src/lib/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SEEN_KEY = "glitchradar.alarmSeen";

// Loud banner for glitches that live less than 15 minutes (expiring or brand-new price errors).
export function GlitchAlarm() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const alarm = useAlarm();
  const settings = useSettings();
  const glow = useSharedValue(1);
  const player = useAudioPlayer(require("@/assets/sounds/radar-ping.wav"));
  const seen = useRef<Set<string> | null>(null);

  const items = alarm.data ?? [];

  // Ping + vibrate only for alarm ids we have never announced before (remembered across app starts).
  useEffect(() => {
    if (!alarm.data) return;
    let cancelled = false;
    (async () => {
      if (!seen.current) {
        const raw = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
        seen.current = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      }
      if (cancelled) return;
      const fresh = alarm.data.filter((g) => !seen.current!.has(g.id));
      if (fresh.length === 0) return;
      fresh.forEach((g) => seen.current!.add(g.id));
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current].slice(-200))).catch(() => {});
      if (!settings.alarmSound) return;
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Audio can be blocked (e.g. browser autoplay rules) – the visual alarm still shows.
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [alarm.data, settings.alarmSound, player]);

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
