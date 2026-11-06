import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { Mascot } from "@/src/components/Mascot";
import { fonts, useTheme } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SHOW_MS = 1800;

// Static intro for the low-overhead beta. Radar/glitch motion and sound are deferred.
export function AppSplash() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

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
        <Mascot pose="neutral" width={190} height={220} />
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
