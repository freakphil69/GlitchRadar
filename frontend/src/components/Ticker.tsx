import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { fmtClock, fmtMoney } from "@/src/lib/format";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Mascot } from "@/src/components/Mascot";

export function Ticker({
  activeCount,
  savings,
  lastScanAt,
  onScan,
}: {
  activeCount?: number;
  savings?: number;
  lastScanAt?: string | null;
  onScan?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View testID="ticker" style={styles.ticker}>
      <View testID="ticker-logo" accessible accessibilityLabel="GlitchRadar">
        <Mascot width={30} height={36} />
      </View>
      <View style={styles.cell}>
        <Animated.View style={[styles.dot, dot]} />
        <Text style={[styles.cellText, { color: colors.success }]}>LIVE</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={[styles.cellText, { color: colors.onSurfaceSecondary }]}>{activeCount ?? "—"} AKTIV</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={[styles.cellText, { color: colors.brandPrimary }]}>
          Σ {savings != null ? fmtMoney(savings) : "—"}
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={styles.scanTime}>{lastScanAt ? `SCAN ${fmtClock(lastScanAt)}` : "KEIN SCAN"}</Text>
      {onScan ? (
        <Pressable testID="ticker-scan-button" onPress={onScan} style={styles.scanBtn} hitSlop={6}>
          <Text style={styles.scanBtnText}>SCAN</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  cell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.success,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: c.divider,
  },
  cellText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  scanTime: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: c.muted,
  },
  scanBtn: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: c.brandPrimary,
    justifyContent: "center",
  },
  scanBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: c.onBrandPrimary,
  },
}));
