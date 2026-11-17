import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
const SHOW_MS = 800;

// Brief static mascot only; no glitch, scan, wink, sound or animation.
export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const { colors } = useTheme();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <View testID="app-splash" style={[styles.overlay, { backgroundColor: colors.surface }]}>
      <Image source={require("@/assets/images/logo-mark.png")} style={styles.mascot} resizeMode="contain" fadeDuration={0} accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  mascot: { width: 220, height: 220 },
});
