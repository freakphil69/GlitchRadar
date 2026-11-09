import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Black Friday = day after the 4th Thursday of November; the deal week runs until Cyber Monday.
function blackFriday(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  const firstThu = 1 + ((4 - nov1.getDay() + 7) % 7);
  return new Date(year, 10, firstThu + 21 + 1, 0, 0, 0);
}

function phase(now: Date): { start: Date; end: Date } {
  let start = blackFriday(now.getFullYear());
  let end = new Date(start.getTime() + 4 * 86_400_000); // through Cyber Monday 23:59
  if (now > end) {
    start = blackFriday(now.getFullYear() + 1);
    end = new Date(start.getTime() + 4 * 86_400_000);
  }
  return { start, end };
}

const SHOW_DAYS_BEFORE = 45;

export function BlackFridayBanner({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { start, end } = phase(now);
  const ms = start.getTime() - now.getTime();
  if (ms > SHOW_DAYS_BEFORE * 86_400_000) return null;
  const live = now >= start && now <= end;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);

  return (
    <Pressable testID="blackfriday-banner" onPress={onPress} style={[styles.box, active && styles.boxActive]}>
      <MaterialCommunityIcons name="tag-multiple" size={22} color={colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{live ? "BLACK FRIDAY LÄUFT" : "BLACK FRIDAY IN"}</Text>
        {live ? (
          <Text style={styles.big}>Alle Aktionsdeals ansehen</Text>
        ) : (
          <Text style={styles.big} testID="blackfriday-countdown">
            {days} TAGE {hours} STD
          </Text>
        )}
      </View>
      <Text style={styles.cta}>{active ? "AKTIV" : "DEALS"}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.warning,
    backgroundColor: c.surfaceSecondary,
  },
  boxActive: { borderWidth: 2 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: c.warning },
  big: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface },
  cta: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: c.warning },
}));
