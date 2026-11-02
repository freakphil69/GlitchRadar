import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { fonts, useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SHOW_MS = 1800;

// Branded intro: logo + radar sweep, then fades into the app.
export function AppSplash() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const logoScale = useSharedValue(0.85);
  const sweep = useSharedValue(0);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    logoScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) });
    sweep.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    opacity.value = withDelay(
      SHOW_MS,
      withTiming(0, { duration: 350 }, (done) => {
        if (done) runOnJS(setVisible)(false);
      }),
    );
  }, [opacity, logoScale, sweep]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - sweep.value,
    transform: [{ scale: 0.6 + sweep.value * 1.2 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      testID="app-splash"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#000000", zIndex: 999 }, wrapStyle]}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { borderColor: colors.brandPrimary }, ringStyle]} />
        <Animated.View style={logoStyle}>
          <Image source={require("@/assets/images/logo-full.png")} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>
      <Text style={[styles.sub, { color: colors.muted, fontFamily: fonts.mono }]}>SCANNE NACH PREISFEHLERN…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", top: -13, width: 200, height: 200, borderRadius: 100, borderWidth: 2 },
  logo: { width: 260, height: 226 },
  sub: { fontSize: 11, letterSpacing: 2, marginTop: 16 },
});
