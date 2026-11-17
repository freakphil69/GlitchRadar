import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { fonts, useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
const SHOW_MS = 1800;

export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const progress = useAnimatedValue(1);
  const { colors } = useTheme();
  useEffect(() => {
    let active = true;
    let reduced = false;
    let animation: Animated.CompositeAnimation | undefined;
    const settle = () => { animation?.stop(); progress.setValue(1); };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (!active) return;
      reduced = enabled;
      if (enabled) settle();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return;
      if (enabled || reduced) { settle(); return; }
      progress.setValue(0);
      animation = Animated.sequence([0.2, 0.4, 0.6, 0.8, 1].map((toValue) =>
        Animated.timing(progress, { toValue, duration: 70, useNativeDriver: true, isInteraction: false })
      ));
      animation.start();
    }).catch(() => { if (active) settle(); });
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      active = false;
      animation?.stop();
      setVisible(false);
    }, SHOW_MS);
    return () => { active = false; clearTimeout(timer); subscription.remove(); animation?.stop(); };
  }, [progress]);

  if (!visible) return null;
  const glitch = {
    opacity: progress.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, 0.75, 0.35, 1, 0.65, 1] }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [-12, 9, -6, 4, -2, 0] }) }],
  };
  return (
    <View testID="app-splash" style={[styles.overlay, { backgroundColor: colors.surface ?? "#0D1117" }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.brand, { fontFamily: fonts.displayBold, color: colors.brandPrimary ?? "#FF6B00" }]}>GlitchRadar</Text>
      <View style={styles.radar}>
        {[260, 206, 152].map((size) => <View key={size} style={[styles.ring, { width: size, height: size, borderColor: colors.success ?? "#19FF3C" }]} />)}
        <View style={[styles.axis, { backgroundColor: colors.success ?? "#19FF3C" }]} />
        <View style={[styles.axis, styles.vertical, { backgroundColor: colors.success ?? "#19FF3C" }]} />
        <Animated.View testID="splash-logo-reveal" style={[styles.figure, glitch]}>
          {/* Compatibility filename; render_logo.py now derives this from crossed.webp. */}
          <Image source={require("@/assets/images/logo-mark.png")} style={styles.figureImage} resizeMode="contain" fadeDuration={0} accessible={false} />
          {/* Stylized right-eye lid; placement requires visual review on a device. */}
          <Animated.View testID="mascot-wink" pointerEvents="none" style={[styles.eyelid, { opacity: progress.interpolate({ inputRange: [0, 0.6, 0.78, 0.9, 1], outputRange: [0, 0, 1, 0, 0] }) }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  brand: { fontSize: 32, letterSpacing: 2, textAlign: "center", maxWidth: "90%", marginBottom: 14 },
  radar: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1, opacity: 0.25 },
  axis: { position: "absolute", width: 260, height: 1, opacity: 0.12 },
  vertical: { transform: [{ rotate: "90deg" }] },
  figure: { width: 220, height: 220 },
  figureImage: { width: 220, height: 220 },
  eyelid: { position: "absolute", left: "53%", top: "25%", width: "17%", height: "6%", backgroundColor: "#22262B", borderBottomColor: "#FFB066", borderBottomWidth: 2, borderRadius: 6 },
});
