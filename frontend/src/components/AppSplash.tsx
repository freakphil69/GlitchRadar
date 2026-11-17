import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, useAnimatedValue, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { fonts } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
const SHOW_MS = 4000;

export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const logo = useAnimatedValue(0);
  const title = useAnimatedValue(0);
  const exit = useAnimatedValue(1);

  useEffect(() => {
    let mounted = true;
    let reduced = false;
    let animation: Animated.CompositeAnimation | undefined;
    const frame = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, useNativeDriver: true, isInteraction: false });
    const settle = () => {
      animation?.stop();
      logo.setValue(1);
      title.setValue(1);
      exit.setValue(1);
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduced = enabled;
      if (enabled) settle();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      if (enabled || reduced) { settle(); return; }
      animation = Animated.parallel([
        Animated.sequence([frame(logo, 0.45, 140), frame(logo, 0.2, 65), frame(logo, 0.8, 130), frame(logo, 0.5, 65), frame(logo, 1, 300)]),
        Animated.sequence([Animated.delay(700), frame(title, 0.4, 65), frame(title, 0.85, 65), frame(title, 0.55, 65), frame(title, 1, 105)]),
        Animated.sequence([Animated.delay(3000), frame(exit, 0.75, 100), frame(exit, 0.95, 80), frame(exit, 0.4, 170), frame(exit, 0.65, 100), frame(exit, 0, 450)]),
      ]);
      animation.start();
    }).catch(settle);
    const timer = setTimeout(() => {
      animation?.stop();
      setVisible(false);
    }, SHOW_MS);
    return () => { mounted = false; clearTimeout(timer); subscription.remove(); animation?.stop(); };
  }, [logo, title, exit]);

  if (!visible) return null;
  return (
    <View testID="app-splash" style={styles.overlay} onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}>
      <Animated.View style={{ opacity: exit, alignItems: "center", transform: [{ translateX: exit.interpolate({ inputRange: [0, 0.4, 0.65, 0.75, 0.95, 1], outputRange: [18, -10, 8, -6, 3, 0] }) }] }}>
        <Animated.View testID="splash-logo-reveal" style={{ opacity: logo, transform: [{ translateX: logo.interpolate({ inputRange: [0, 0.2, 0.45, 0.5, 0.8, 1], outputRange: [-18, 10, -8, 6, -3, 0] }) }] }}>
          <Image source={require("@/assets/images/logo-mark.png")} style={styles.logo} resizeMode="contain" fadeDuration={0} accessible={false} />
        </Animated.View>
        <Animated.View style={{ opacity: title, transform: [{ translateX: title.interpolate({ inputRange: [0, 0.4, 0.55, 0.85, 1], outputRange: [-10, 8, -4, 2, 0] }) }] }}>
          <Text style={[styles.brand, { fontFamily: fonts.displayBold }]}>GLITCHRADAR</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  logo: { width: 240, height: 240, maxWidth: "80%" },
  brand: { color: "#FFFFFF", fontSize: 30, letterSpacing: 3, marginTop: 16, textAlign: "center" },
});
