import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Mascot } from './Mascot';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function AppSplash() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    const timers = [260, 560, 890, 1240, 1320, 2120].map((ms, i) => setTimeout(() => setFrame(i + 1), ms));
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!mounted || !reduce) return;
      timers.forEach(clearTimeout);
      setFrame(5);
      timers.push(setTimeout(() => setFrame(6), 800));
    }).catch(() => {});
    return () => { mounted = false; timers.forEach(clearTimeout); };
  }, []);
  if (frame >= 6) return null;
  return <View testID="app-splash" style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {frame >= 4 ? <View style={frame === 4 ? styles.glitch : undefined}><Mascot pose="neutral" width={220} height={220} /></View> : <View style={styles.mark}>
      {frame >= 2 && <View style={styles.house}><View style={[styles.roof, styles.left]} /><View style={[styles.roof, styles.right]} /></View>}
      <Text style={styles.initials}>F<Text style={{ color: frame >= 1 ? '#b8e638' : '#343b24' }}>L</Text></Text>
      {frame >= 3 && <Text style={styles.word}>Freak <Text style={styles.green}>L</Text>abs</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
  mark: { width: 220, height: 210, alignItems: 'center', justifyContent: 'center' },
  house: { position: 'absolute', top: 65, width: 174, height: 93, borderWidth: 2, borderTopWidth: 0, borderColor: '#eeeae0' },
  roof: { position: 'absolute', top: -18, width: 101, height: 2, backgroundColor: '#eeeae0' },
  left: { left: -7, transform: [{ rotate: '-29deg' }] },
  right: { right: -7, transform: [{ rotate: '29deg' }] },
  initials: { fontSize: 66, fontWeight: '700', color: '#eeeae0' },
  word: { position: 'absolute', bottom: 13, fontSize: 25, letterSpacing: 2, color: '#eeeae0' },
  green: { color: '#b8e638' },
  glitch: { opacity: 0.72, transform: [{ translateX: -14 }, { skewX: '-10deg' }] },
});
