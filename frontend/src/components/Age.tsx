import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export function ageLabel(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "GERADE EBEN";
  if (min < 60) return `VOR ${min} MIN`;
  const h = Math.floor(min / 60);
  if (h < 24) return `VOR ${h} STD`;
  return `VOR ${Math.floor(h / 24)} TG`;
}

// "Found online X minutes ago" — real deals have no known end time, so we show freshness instead.
export function Age({ publishedAt, size = "sm" }: { publishedAt: string; size?: "sm" | "lg" }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const min = (now - new Date(publishedAt).getTime()) / 60000;
  const tone = min < 60 ? colors.success : min < 360 ? colors.warning : colors.muted;
  const label = ageLabel(publishedAt, now);

  if (size === "lg") {
    return (
      <View style={{ gap: 2 }}>
        <Text style={styles.lgLabel}>ONLINE ENTDECKT</Text>
        <Text testID="age-lg" style={[styles.lgText, { color: tone }]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View testID="age-pill" style={[styles.pill, { borderColor: tone }]}>
      <MaterialCommunityIcons name="radar" size={13} color={tone} />
      <Text style={[styles.pillText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 28,
  },
  pillText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  lgLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: c.onSurfaceTertiary,
  },
  lgText: {
    fontFamily: fonts.mono,
    fontSize: 24,
    letterSpacing: 1,
  },
}));
