import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/lib/auth";
import { isTestStore, useSubscription } from "@/src/lib/revenuecat";
import { FREE_SCANS_PER_DAY } from "@/src/lib/scanQuota";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PERKS = [
  { icon: "infinity", title: "Unbegrenzte Scans", text: `Gratis: ${FREE_SCANS_PER_DAY} manuelle Scans pro Tag` },
  { icon: "brain", title: "KI-Schritt-für-Schritt-Pläne", text: "Claude-Analyse für jeden Fund" },
  { icon: "lightning-bolt", title: "Sofort-Zugriff", text: "Neue Preisfehler sehen, sobald sie online sind" },
  { icon: "heart", title: "Unterstützt die Entwicklung", text: "Mehr Quellen, schnellere Scans" },
] as const;

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const sub = useSubscription();
  const auth = useAuth();
  const [confirm, setConfirm] = useState<PurchasesPackage | null>(null);

  const packages = sub.offerings?.current?.availablePackages ?? [];

  const doPurchase = async (pkg: PurchasesPackage) => {
    setConfirm(null);
    try {
      await sub.purchase(pkg);
      toast("PRO freigeschaltet!", "success");
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return;
      toast(err.message === "identity_not_ready" ? "Für den Kauf ist ein Konto nötig" : err.message || "Kauf fehlgeschlagen", "error");
    }
  };

  const onBuy = (pkg: PurchasesPackage) => {
    if (isTestStore) setConfirm(pkg);
    else doPurchase(pkg);
  };

  const onRestore = async () => {
    try {
      await sub.restore();
      toast("Käufe wiederhergestellt", "success");
    } catch (e) {
      toast((e as Error).message || "Wiederherstellen fehlgeschlagen", "error");
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.headerRow}>
          <Pressable testID="pro-close-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <Text style={styles.kicker}>GLITCHRADAR</Text>
        <Text style={styles.title}>PRO</Text>
        <Text style={styles.subtitle}>Sei schneller als der Patch.</Text>

        {sub.isSubscribed ? (
          <View style={styles.activeBox} testID="pro-active">
            <MaterialCommunityIcons name="check-decagram" size={22} color={colors.success} />
            <Text style={styles.activeText}>PRO IST AKTIV</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {PERKS.map((p) => (
            <View key={p.title} style={styles.perkRow}>
              <MaterialCommunityIcons name={p.icon} size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkText}>{p.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {!sub.isSubscribed ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.lg }}>
            {sub.isLoading ? (
              <ActivityIndicator color={colors.brandPrimary} testID="pro-loading" />
            ) : packages.length === 0 ? (
              <Text style={styles.note} testID="pro-unavailable">
                Abo-Optionen sind gerade nicht verfügbar. Bitte versuche es später erneut.
              </Text>
            ) : (
              <>
                {!auth.user ? (
                  <View style={styles.banner} testID="pro-login-banner">
                    <MaterialCommunityIcons name="account-alert" size={18} color={colors.warning} />
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      <Text style={styles.bannerText}>
                        Melde dich an, damit dein Abo an dein Konto gebunden ist und nie verloren geht.
                      </Text>
                      <Pressable testID="pro-login-button" onPress={() => router.push("/login")} style={styles.restoreBtn}>
                        <Text style={styles.restoreText}>ANMELDEN / REGISTRIEREN</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : !sub.identityReady ? (
                  <View style={styles.banner} testID="pro-identity-banner">
                    <MaterialCommunityIcons name="account-sync" size={18} color={colors.warning} />
                    <Text style={styles.bannerText}>
                      {auth.identityError ? `Konto-Verknüpfung fehlgeschlagen: ${auth.identityError}` : "Verknüpfe Konto mit dem Store…"}
                    </Text>
                  </View>
                ) : null}
                {packages.map((pkg) => {
                  const intro = pkg.product.introPrice;
                  const locked = !auth.user || !sub.identityReady || sub.isPurchasing;
                  return (
                    <Pressable
                      key={pkg.identifier}
                      testID={`pro-buy-${pkg.identifier}`}
                      disabled={locked}
                      onPress={() => onBuy(pkg)}
                      style={[styles.buyBtn, locked && { opacity: 0.45 }]}
                    >
                      <Text style={styles.buyText}>
                        {pkg.packageType === "ANNUAL" ? "JÄHRLICH" : "MONATLICH"} · {pkg.product.priceString}
                      </Text>
                      {intro ? (
                        <Text style={styles.introText}>
                          {intro.priceString} für die ersten {intro.cycles * intro.periodNumberOfUnits}{" "}
                          {intro.periodUnit === "MONTH" ? "Monate" : intro.periodUnit === "WEEK" ? "Wochen" : "Zeiträume"}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </>
            )}
            <Pressable testID="pro-restore-button" onPress={onRestore} disabled={sub.isRestoring} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>{sub.isRestoring ? "STELLE WIEDER HER…" : "KÄUFE WIEDERHERSTELLEN"}</Text>
            </Pressable>
            {isTestStore ? <Text style={styles.note}>Vorschau: Käufe laufen im RevenueCat-Test-Store (simuliert).</Text> : null}
            <Text style={styles.note}>Abo verlängert sich automatisch und ist jederzeit in den Store-Einstellungen kündbar.</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard} testID="pro-confirm-modal">
            <Text style={styles.modalTitle}>TEST-KAUF BESTÄTIGEN</Text>
            <Text style={styles.perkText}>Simulierter Kauf über den RevenueCat-Test-Store: {confirm?.product.priceString}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable testID="pro-confirm-cancel" onPress={() => setConfirm(null)} style={[styles.restoreBtn, { flex: 1 }]}>
                <Text style={styles.restoreText}>ABBRECHEN</Text>
              </Pressable>
              <Pressable testID="pro-confirm-ok" onPress={() => confirm && doPurchase(confirm)} style={[styles.buyBtn, { flex: 1 }]}>
                <Text style={styles.buyText}>KAUFEN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  headerRow: { flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 3, color: c.muted, paddingHorizontal: spacing.lg },
  title: { fontFamily: fonts.displayBold, fontSize: 64, color: c.brandPrimary, paddingHorizontal: spacing.lg, lineHeight: 68 },
  subtitle: { fontFamily: fonts.text, fontSize: 15, color: c.onSurfaceSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  activeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.success,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  activeText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.5, color: c.success },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  perkRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  perkTitle: { fontFamily: fonts.text, fontSize: 15, color: c.onSurface },
  perkText: { fontFamily: fonts.textRegular, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  banner: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: c.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  bannerText: { flex: 1, fontFamily: fonts.textRegular, fontSize: 12, lineHeight: 17, color: c.onSurfaceSecondary },
  buyBtn: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  buyText: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1.5, color: c.onBrandPrimary },
  introText: { fontFamily: fonts.text, fontSize: 11, color: c.onBrandPrimary, opacity: 0.9, marginTop: 2 },
  restoreBtn: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, color: c.onSurfaceSecondary },
  note: { fontFamily: fonts.textRegular, fontSize: 11, color: c.muted, textAlign: "center", lineHeight: 16 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl },
  modalCard: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.5, color: c.onSurface },
}));
