import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, useAnimatedValue, Image, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
const SHOW_MS = 1200;

// Short mascot glitch; no developer logo or looping intro.
export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const { colors } = useTheme();
  const shift = useAnimatedValue(0);
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    let disposed = false;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (disposed || reduced) return;
      animation = Animated.sequence([-5, 4, -2, 0].map(toValue => Animated.timing(shift, { toValue, duration: 50, useNativeDriver: true })));
      animation.start();
    }).catch(() => {});
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => { disposed = true; clearTimeout(timer); animation?.stop(); shift.stopAnimation(); };
  }, [shift]);
  if (!visible) return null;
  return (
    <View testID="app-splash" style={[styles.overlay, { backgroundColor: colors.surface }]}>
      <Animated.View style={{ alignItems: "center", transform: [{ translateX: shift }] }}>
      <Image source={require("@/assets/images/logo-mark.png")} style={styles.mascot} resizeMode="contain" fadeDuration={0} accessible={false} />
      <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: 3, marginTop: 12 }}>GLITCH RADAR</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  mascot: { width: 220, height: 220 },
});
