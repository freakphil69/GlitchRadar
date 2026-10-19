import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { makeStyles, useTheme } from "@/src/theme";

export function RadarSweep({ size = 220, active = false }: { size?: number; active?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: active ? 2400 : 7000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [active, rot]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const blips = useMemo(
    () => [
      { x: 0.3, y: 0.34, delay: 0 },
      { x: 0.68, y: 0.28, delay: 600 },
      { x: 0.62, y: 0.7, delay: 1200 },
      { x: 0.24, y: 0.68, delay: 1800 },
    ],
    [],
  );

  return (
    <View testID="radar-sweep" style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.ring, { width: size, height: size }]} />
      <View style={[styles.ring, { width: size * 0.72, height: size * 0.72 }]} />
      <View style={[styles.ring, { width: size * 0.44, height: size * 0.44 }]} />
      <View style={styles.crossH} />
      <View style={styles.crossV} />
      <Animated.View style={[styles.sweep, { borderRadius: size / 2 }, sweepStyle]} pointerEvents="none">
        <LinearGradient
          style={{ flex: 1 }}
          colors={["transparent", "transparent", `${colors.brand}55`]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
        <View style={styles.beam} />
      </Animated.View>
      {blips.map((b) => (
        <Blip key={`${b.x}-${b.y}`} x={b.x} y={b.y} delay={b.delay} active={active} />
      ))}
      <View style={styles.centerDot} />
    </View>
  );
}

function Blip({ x, y, delay, active }: { x: number; y: number; delay: number; active: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const o = useSharedValue(0.15);

  useEffect(() => {
    o.value = active
      ? withDelay(
          delay,
          withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.15, { duration: 900 })), -1),
        )
      : 0.15;
  }, [active, delay, o]);

  const style = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View
      style={[styles.blip, { left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: colors.success }, style]}
    />
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 999,
  },
  crossH: {
    position: "absolute",
    height: 1,
    width: "100%",
    backgroundColor: c.divider,
  },
  crossV: {
    position: "absolute",
    width: 1,
    height: "100%",
    backgroundColor: c.divider,
  },
  sweep: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  beam: {
    position: "absolute",
    width: 2,
    height: "50%",
    left: "50%",
    top: 0,
    marginLeft: -1,
    backgroundColor: c.brandPrimary,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.brandPrimary,
  },
  blip: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
}));
