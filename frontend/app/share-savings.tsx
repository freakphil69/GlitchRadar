import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { Mascot } from "@/src/components/Mascot";
import { fmtMoney } from "@/src/lib/format";
import { useStash } from "@/src/lib/stash";
import { savingOf } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SHARE_TEXT = (amount: string) =>
  `GLITCH ALARM: Ich habe mit GlitchRadar schon ${amount} an Preisfehlern & Gutschein-Glitches gespart. Hol dir die App und sei schneller als der Patch!`;

export default function ShareSavingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const stash = useStash();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const items = stash.data ?? [];
  const claimed = items.filter((i) => i.claimed);
  const usingClaimed = claimed.length > 0;
  const base = usingClaimed ? claimed : items;
  const total = base.reduce((s, i) => s + savingOf(i.glitch), 0);
  const best = base.reduce<(typeof base)[number] | null>(
    (b, i) => (!b || savingOf(i.glitch) > savingOf(b.glitch) ? i : b),
    null,
  );
  const maxDiscount = base.reduce((m, i) => Math.max(m, i.glitch.discount_pct || 0), 0);

  // 9:16 story card that fits the screen.
  const cardW = Math.min(width - spacing.lg * 2, (height - insets.top - insets.bottom - 200) * (9 / 16), 420);
  const cardH = cardW * (16 / 9);
  const k = cardW / 360;

  const onShare = async () => {
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "data-uri", width: 1080, height: 1920 });
        const a = document.createElement("a");
        a.href = uri;
        a.download = "glitchradar-ersparnis.png";
        a.click();
        toast("Grafik gespeichert", "success");
        return;
      }
      const uri = await captureRef(cardRef, { format: "png", quality: 1, width: 1080, height: 1920 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Ersparnis teilen" });
      } else {
        await Share.share({ message: SHARE_TEXT(fmtMoney(total)) });
      }
    } catch {
      toast("Teilen fehlgeschlagen", "error");
    } finally {
      setBusy(false);
    }
  };

  const onShareText = async () => {
    const message = SHARE_TEXT(fmtMoney(total));
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ text: message });
        } else {
          await navigator.clipboard.writeText(message);
          toast("Text kopiert – jetzt einfügen und posten", "success");
        }
        return;
      }
      await Share.share({ message });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast("Teilen fehlgeschlagen", "error");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.header}>
        <Pressable testID="share-close-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>STORY TEILEN</Text>
      </View>

      <View style={styles.center}>
        <View
          ref={cardRef}
          collapsable={false}
          testID="share-story-card"
          style={[styles.card, { width: cardW, height: cardH, padding: 24 * k }]}
        >
          <View style={styles.brandRow}>
            <Mascot width={40 * k} height={46 * k} />
            <Text style={[styles.brand, { fontSize: 18 * k }]}>GLITCHRADAR</Text>
          </View>

          <View style={[styles.radar, { width: 220 * k, height: 220 * k, borderRadius: 110 * k }]}>
            <View style={[styles.radarRing, { width: 150 * k, height: 150 * k, borderRadius: 75 * k }]} />
            <View style={[styles.radarRing, { width: 80 * k, height: 80 * k, borderRadius: 40 * k }]} />
            <MaterialCommunityIcons name="radar" size={36 * k} color={colors.brandPrimary} />
          </View>

          <View style={{ gap: 6 * k }}>
            <Text style={[styles.kicker, { fontSize: 12 * k }]}>
              {usingClaimed ? "ICH HABE GESPART" : "GERADE IM VISIER"}
            </Text>
            <Text testID="share-story-amount" style={[styles.amount, { fontSize: 56 * k }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtMoney(total)}
            </Text>
            <Text style={[styles.sub, { fontSize: 14 * k }]}>
              mit {base.length} {base.length === 1 ? "Glitch" : "Glitches"}
              {maxDiscount > 0 ? ` · bis zu −${maxDiscount} %` : ""}
            </Text>
          </View>

          {best && savingOf(best.glitch) > 0 ? (
            <View style={[styles.best, { padding: 12 * k }]}>
              <Text style={[styles.bestLabel, { fontSize: 10 * k }]}>BESTER FANG</Text>
              <Text style={[styles.bestTitle, { fontSize: 14 * k }]} numberOfLines={2}>
                {best.glitch.title}
              </Text>
              <Text style={[styles.bestSave, { fontSize: 13 * k }]}>−{fmtMoney(savingOf(best.glitch))} bei {best.glitch.shop}</Text>
            </View>
          ) : (
            <View />
          )}

          <Text style={[styles.footer, { fontSize: 11 * k }]}>Preisfehler & Gutschein-Glitches in Echtzeit · GlitchRadar</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.hint}>Speichere Glitches im Stash und markiere Käufe als „gesichert“, dann füllt sich deine Grafik.</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          testID="share-image-button"
          onPress={onShare}
          disabled={busy || items.length === 0}
          style={[styles.primary, (busy || items.length === 0) && { opacity: 0.5 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons name="instagram" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>{Platform.OS === "web" ? "BILD SPEICHERN" : "ALS STORY TEILEN"}</Text>
            </>
          )}
        </Pressable>
        <Pressable
          testID="share-text-button"
          onPress={onShareText}
          disabled={items.length === 0}
          style={[styles.secondary, items.length === 0 && { opacity: 0.4 }]}
        >
          <Text style={styles.secondaryText}>NUR TEXT TEILEN</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface, letterSpacing: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    borderRadius: radius.lg,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontFamily: fonts.mono, letterSpacing: 3, color: c.onSurface },
  radar: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: { position: "absolute", borderWidth: 1, borderColor: c.border },
  kicker: { fontFamily: fonts.mono, letterSpacing: 3, color: c.muted },
  amount: { fontFamily: fonts.displayBold, color: c.success },
  sub: { fontFamily: fonts.text, color: c.onSurfaceSecondary },
  best: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, gap: 4 },
  bestLabel: { fontFamily: fonts.mono, letterSpacing: 2, color: c.warning },
  bestTitle: { fontFamily: fonts.text, color: c.onSurface },
  bestSave: { fontFamily: fonts.mono, color: c.success },
  footer: { fontFamily: fonts.mono, color: c.muted, textAlign: "center", letterSpacing: 0.5 },
  hint: {
    fontFamily: fonts.textRegular,
    fontSize: 12,
    color: c.onSurfaceTertiary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  primary: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 2, color: c.onBrandPrimary },
  secondary: { height: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, color: c.brandPrimary },
}));
