import { useNow } from "@/src/lib/useNow";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { trialLeftText, useSubscription } from "@/src/lib/revenuecat";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DISMISS_KEY = "glitchradar.trialEndDismissed";
const LAST_DAY_MS = 24 * 60 * 60 * 1000;

// Friendly nudge on the last trial day, highlighting the annual plan's saving vs. monthly.
export function TrialEndBanner() {
  const now = useNow();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const sub = useSubscription();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => setDismissed(v != null && v === String(sub.trialEndsAt)))
      .catch(() => setDismissed(false));
  }, [sub.trialEndsAt]);

  const ends = sub.trialEndsAt;
  if (!sub.trialActive || !ends || ends - now > LAST_DAY_MS || dismissed !== false) return null;

  const pkgs = sub.offerings?.current?.availablePackages ?? [];
  const annual = pkgs.find((p) => p.packageType === "ANNUAL");
  const monthly = pkgs.find((p) => p.packageType === "MONTHLY");
  const savePct =
    annual && monthly && monthly.product.price > 0
      ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100)
      : null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, String(ends)).catch(() => {});
  };

  return (
    <Pressable testID="trial-end-banner" onPress={() => router.push("/pro")} style={styles.box}>
      <View style={styles.head}>
        <MaterialCommunityIcons name="gift-outline" size={20} color={colors.brandPrimary} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          LETZTER TESTTAG · {trialLeftText(ends).toUpperCase()}
        </Text>
        <Pressable testID="trial-end-dismiss" onPress={dismiss} hitSlop={10} style={styles.close}>
          <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={styles.text}>
        Hat dir das Radar geholfen? Bleib dran, ohne Scan-Limit.
        {annual
          ? ` Mit dem Jahres-Abo für ${annual.product.priceString}${savePct && savePct > 0 ? ` sparst du ${savePct} % gegenüber monatlich` : ""}.`
          : ""}
      </Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>JAHRES-ANGEBOT ANSEHEN</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onBrandPrimary} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    borderWidth: 1,
    borderColor: c.brandPrimary,
    borderRadius: radius.md,
    backgroundColor: c.brandTertiary,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: c.onBrandTertiary },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.textRegular, fontSize: 14, lineHeight: 20, color: c.onSurface },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
  },
  ctaText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.5, color: c.onBrandPrimary },
}));
