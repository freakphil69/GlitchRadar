import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { fonts, useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SHOW_MS = 1800;

// Short native-driven splash sequence: all 6 wings remain visible in the foreground
// while the green radar sweep rotates behind the emblem and GLITCHRADAR glitches in.
export function AppSplash() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);
  const sweep = useAnimatedValue(0);
  const textGlitch = useAnimatedValue(1);
  const exitGlitch = useAnimatedValue(1);
  const dismissed = useRef(false);

  useEffect(() => {
    let mounted = true;
    let motionDisabled = false;
    let anim: Animated.CompositeAnimation | undefined;

    const settle = () => {
      anim?.stop();
      sweep.setValue(0);
      textGlitch.setValue(1);
      exitGlitch.setValue(1);
    };

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      motionDisabled = enabled;
      if (enabled) settle();
    });

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted || dismissed.current || reduceMotion || motionDisabled) return;
        sweep.setValue(0);
        textGlitch.setValue(0);
        exitGlitch.setValue(1);

        anim = Animated.parallel([
          Animated.timing(sweep, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.sequence([
            Animated.delay(450),
            Animated.timing(textGlitch, { toValue: 0.4, duration: 55, useNativeDriver: true, isInteraction: false }),
            Animated.timing(textGlitch, { toValue: 0.9, duration: 55, useNativeDriver: true, isInteraction: false }),
            Animated.timing(textGlitch, { toValue: 0.55, duration: 55, useNativeDriver: true, isInteraction: false }),
            Animated.timing(textGlitch, { toValue: 1, duration: 75, useNativeDriver: true, isInteraction: false }),
          ]),
          Animated.sequence([
            Animated.delay(1480),
            Animated.timing(exitGlitch, { toValue: 0, duration: 280, useNativeDriver: true, isInteraction: false }),
          ]),
        ]);
        anim.start();
      })
      .catch(() => {
        /* Keep static splash if accessibility check fails. */
      });

    return () => {
      mounted = false;
      subscription.remove();
      anim?.stop();
    };
  }, [sweep, textGlitch, exitGlitch]);

  useEffect(() => {
    dismissed.current = false;
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      dismissed.current = true;
      sweep.stopAnimation();
      textGlitch.stopAnimation();
      exitGlitch.stopAnimation();
      setVisible(false);
    }, SHOW_MS);
    return () => {
      dismissed.current = true;
      clearTimeout(timer);
    };
  }, [sweep, textGlitch, exitGlitch]);

  if (!visible) return null;

  const sweepRotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      testID="app-splash"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        {
          backgroundColor: colors.surface,
          zIndex: 999,
          opacity: exitGlitch,
          transform: [
            {
              translateX: exitGlitch.interpolate({
                inputRange: [0, 0.4, 0.8, 1],
                outputRange: [18, -10, 4, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.radar}>
        <View style={[styles.ring, { width: 266, height: 266, borderColor: colors.brandPrimary, opacity: 0.35 }]} />
        <View style={[styles.ring, { width: 206, height: 206, borderColor: colors.brandPrimary, opacity: 0.55 }]} />
        <Animated.View
          style={[
            styles.sweepContainer,
            { transform: [{ rotate: sweepRotate }] },
          ]}
        >
          <View style={[styles.sweepLine, { backgroundColor: colors.success }]} />
        </Animated.View>
        <View testID="splash-logo-reveal" style={styles.logoForeground}>
          <Image
            source={require("@/assets/images/logo-mark.png")}
            style={{ width: 170, height: 170 }}
            resizeMode="contain"
            fadeDuration={0}
            accessible={false}
          />
        </View>
      </View>

      <Animated.View
        style={{
          opacity: textGlitch,
          transform: [
            {
              translateX: textGlitch.interpolate({
                inputRange: [0, 0.4, 0.55, 0.9, 1],
                outputRange: [-10, 8, -4, 2, 0],
              }),
            },
          ],
        }}
      >
        <Text style={[styles.brand, { color: colors.onSurface, fontFamily: fonts.displayBold }]}>GLITCHRADAR</Text>
      </Animated.View>
      <Text style={[styles.sub, { color: colors.muted, fontFamily: fonts.mono }]}>DEIN RADAR FÜR PREISFEHLER</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  radar: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1 },
  sweepContainer: {
    position: "absolute",
    width: 266,
    height: 266,
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 1,
  },
  sweepLine: {
    width: 2,
    height: 133,
    borderRadius: 2,
    opacity: 0.9,
  },
  logoForeground: {
    zIndex: 2,
  },
  brand: { fontSize: 34, letterSpacing: 4, marginTop: 10 },
  sub: { fontSize: 10, letterSpacing: 1.5, marginTop: 10, textAlign: "center" },
});
