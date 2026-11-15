import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { fonts, useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SHOW_MS = 1800;

// One short native-driven reveal, never a loop; the radar rings remain static.
export function AppSplash() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);
  const reveal = useAnimatedValue(1);
  const dismissed = useRef(false);

  useEffect(() => {
    let mounted = true;
    let motionDisabled = false;
    let animation: Animated.CompositeAnimation | undefined;
    const settle = () => {
      animation?.stop();
      reveal.setValue(1);
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      motionDisabled = enabled;
      if (enabled) settle();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || dismissed.current || reduceMotion || motionDisabled) return;
      reveal.setValue(0);
      animation = Animated.sequence(
        [0.65, 0.25, 0.9, 0.6, 1].map((toValue) =>
          Animated.timing(reveal, { toValue, duration: 70, useNativeDriver: true, isInteraction: false }),
        ),
      );
      animation.start();
    }).catch(() => { /* Keep the static logo if the accessibility check fails. */ });
    return () => {
      mounted = false;
      subscription.remove();
      animation?.stop();
    };
  }, [reveal]);

  useEffect(() => {
    dismissed.current = false;
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      dismissed.current = true;
      reveal.stopAnimation();
      reveal.setValue(1);
      setVisible(false);
    }, SHOW_MS);
    return () => {
      dismissed.current = true;
      clearTimeout(timer);
    };
  }, [reveal]);

  if (!visible) return null;

  return (
    <View
      testID="app-splash"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.surface, zIndex: 999 }]}
    >
      <View style={styles.radar}>
        <View style={[styles.ring, { width: 266, height: 266, borderColor: colors.border }]} />
        <View style={[styles.ring, { width: 206, height: 206, borderColor: colors.border }]} />
        <Animated.View
          testID="splash-logo-reveal"
          style={{
            opacity: reveal.interpolate({ inputRange: [0, 0.25, 0.65, 1], outputRange: [0.15, 0.45, 0.75, 1] }),
            transform: [{
              translateX: reveal.interpolate({ inputRange: [0, 0.25, 0.6, 0.9, 1], outputRange: [-12, 9, -5, 3, 0] }),
            }],
          }}
        >
          <Image
            source={require("@/assets/images/logo-mark.png")}
            style={{ width: 170, height: 170 }}
            resizeMode="contain"
            fadeDuration={0}
            accessible={false}
          />
        </Animated.View>
      </View>
      <Text style={[styles.brand, { color: colors.brandPrimary, fontFamily: fonts.displayBold }]}>GLITCHRADAR</Text>
      <Text style={[styles.sub, { color: colors.muted, fontFamily: fonts.mono }]}>DEIN RADAR FÜR PREISFEHLER</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  radar: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1 },
  brand: { fontSize: 34, letterSpacing: 3, marginTop: 8 },
  sub: { fontSize: 10, letterSpacing: 1.5, marginTop: 12, textAlign: "center" },
});
