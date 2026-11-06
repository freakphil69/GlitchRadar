import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { fonts, makeStyles, useTheme } from "@/src/theme";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function Countdown({ expiresAt, size = "sm" }: { expiresAt: string; size?: "sm" | "lg" }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());

  // Tick every second only in the last hour (seconds visible); otherwise once a minute.
  const lastHour = new Date(expiresAt).getTime() - now < 3_600_000;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), lastHour ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [lastHour]);

  const ms = new Date(expiresAt).getTime() - now;
  const expired = ms <= 0;
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = expired ? "ABGELAUFEN" : h > 0 ? `${h} STD ${pad(m)} MIN` : `${pad(m)}:${pad(s)}`;
  const critical = !expired && totalSec < 15 * 60;
  const tone = expired ? colors.muted : h >= 2 ? colors.success : totalSec >= 15 * 60 ? colors.warning : colors.error;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (critical) {
      pulse.value = withRepeat(withSequence(withTiming(0.35, { duration: 450 }), withTiming(1, { duration: 450 })), -1);
    } else {
      pulse.value = 1;
    }
  }, [critical, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (size === "lg") {
    return (
      <View style={styles.lgWrap}>
        <Text style={styles.lgLabel}>{expired ? "STATUS" : "ZEITFENSTER"}</Text>
        <Animated.Text testID="countdown-lg" style={[styles.lgText, { color: tone }, pulseStyle]}>
          {label}
        </Animated.Text>
      </View>
    );
  }

  return (
    <View testID="countdown-pill" style={[styles.pill, { borderColor: tone }]}>
      <Animated.View style={pulseStyle}>
        <MaterialCommunityIcons name="timer" size={13} color={tone} />
      </Animated.View>
      <Text style={[styles.pillText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 28,
  },
  pillText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  lgWrap: {
    gap: 2,
  },
  lgLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: c.onSurfaceTertiary,
  },
  lgText: {
    fontFamily: fonts.mono,
    fontSize: 34,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
}));
