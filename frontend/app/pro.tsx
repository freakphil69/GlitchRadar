import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/lib/auth";
import { isTestStore, useSubscription } from "@/src/lib/revenuecat";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PERKS = [
  "Echte Preisfehler & Fehlkalkulationen",
  "Starke Promo-Codes & Blitzangebote",
  "Community-geprüfte Deals",
  "Unbegrenzte Scans & KI-Pläne",
];

// Cards in the order of the design; any other package (e.g. lifetime) is shown below.
const CARD_ORDER = ["WEEKLY", "ANNUAL", "MONTHLY"] as const;
const PLAN_META: Record<string, { label: string; per: string; cta: string }> = {
  WEEKLY: { label: "Wöchentlich", per: "/ Woche", cta: "Wöchentlich sichern" },
  MONTHLY: { label: "Monatlich", per: "/ Monat", cta: "Monatlich sichern" },
  ANNUAL: { label: "Jährlich", per: "/ Jahr", cta: "Jährlich sichern" },
  LIFETIME: { label: "Lifetime", per: "einmalig", cta: "Lifetime sichern" },
};

function perMonth(pkg: PurchasesPackage): string | null {
  const p = pkg.product;
  if (p.pricePerMonthString) return p.pricePerMonthString;
  if (!p.price) return null;
  return `${(p.price / 12).toFixed(2).replace(".", ",")} €`;
}

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const sub = useSubscription();
  const auth = useAuth();
  const [confirm, setConfirm] = useState<PurchasesPackage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const packages = useMemo(() => sub.offerings?.current?.availablePackages ?? [], [sub.offerings]);
  const cards = CARD_ORDER.map((t) => packages.find((p) => p.packageType === t)).filter(
    (p): p is PurchasesPackage => !!p,
  );
  const extras = packages.filter((p) => !cards.includes(p));

  useEffect(() => {
    if (selectedId || packages.length === 0) return;
    const def = packages.find((p) => p.packageType === "ANNUAL") ?? packages[0];
    setSelectedId(def.identifier);
  }, [packages, selectedId]);

  const selected = packages.find((p) => p.identifier === selectedId) ?? null;
  const locked = !auth.user || !sub.identityReady || sub.isPurchasing;

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

  const onBuy = () => {
    if (!selected) return;
    if (isTestStore) setConfirm(selected);
    else doPurchase(selected);
  };

  const onRestore = async () => {
    try {
      await sub.restore();
      toast("Käufe wiederhergestellt", "success");
    } catch (e) {
      toast((e as Error).message || "Wiederherstellen fehlgeschlagen", "error");
    }
  };

  const metaOf = (pkg: PurchasesPackage) =>
    PLAN_META[pkg.packageType] ?? { label: pkg.product.title, per: "", cta: "Jetzt sichern" };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.headerRow}>
          <Pressable testID="pro-close-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.brandRow}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
          <View>
            <Text style={styles.brand}>Glitch Radar</Text>
            <Text style={styles.brandSub}>Dein Deal- & Preisfehler-Finder</Text>
          </View>
        </View>

        <Text style={styles.title}>Spare bares Geld mit</Text>
        <Text style={[styles.title, { color: colors.brandPrimary }]}>echten Preisfehlern</Text>
        <Text style={styles.subtitle}>Finde Angebote, bevor sie wieder verschwinden.</Text>

        <View style={styles.perks}>
          {PERKS.map((p, i) => (
            <View key={p} style={[styles.perkRow, i > 0 && styles.perkDivider]}>
              <View style={styles.check}>
                <MaterialCommunityIcons name="check" size={16} color={colors.onBrandPrimary} />
              </View>
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        {sub.isSubscribed ? (
          <View style={styles.activeBox} testID="pro-active">
            <MaterialCommunityIcons name="check-decagram" size={22} color={colors.success} />
            <Text style={styles.activeText}>PRO IST AKTIV – DANKE!</Text>
          </View>
        ) : sub.isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} testID="pro-loading" />
        ) : packages.length === 0 ? (
          <Text style={[styles.note, { marginTop: spacing.xl }]} testID="pro-unavailable">
            Abo-Optionen sind gerade nicht verfügbar. Bitte versuche es später erneut.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.lg }}>
            <View style={styles.cardsRow}>
              {cards.map((pkg) => {
                const on = pkg.identifier === selectedId;
                const featured = pkg.packageType === "ANNUAL";
                const m = metaOf(pkg);
                return (
                  <Pressable
                    key={pkg.identifier}
                    testID={`pro-plan-${pkg.packageType.toLowerCase()}`}
                    onPress={() => setSelectedId(pkg.identifier)}
                    style={[styles.planCard, on && styles.planCardOn]}
                  >
                    {featured ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Empfohlen</Text>
                        <MaterialCommunityIcons name="star" size={12} color={colors.onBrandPrimary} />
                      </View>
                    ) : null}
                    <Text style={styles.planLabel}>{m.label}</Text>
                    <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {pkg.product.priceString}
                    </Text>
                    {featured && perMonth(pkg) ? (
                      <Text style={styles.planPerHighlight}>Nur {perMonth(pkg)} / Monat</Text>
                    ) : (
                      <Text style={styles.planPer}>{m.per}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {extras.map((pkg) => {
              const on = pkg.identifier === selectedId;
              const m = metaOf(pkg);
              return (
                <Pressable
                  key={pkg.identifier}
                  testID={`pro-plan-${pkg.packageType.toLowerCase()}`}
                  onPress={() => setSelectedId(pkg.identifier)}
                  style={[styles.extraCard, on && styles.planCardOn]}
                >
                  <MaterialCommunityIcons name="infinity" size={22} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planLabel}>{m.label}</Text>
                    <Text style={styles.planPer}>Einmal zahlen, für immer PRO</Text>
                  </View>
                  <Text style={styles.extraPrice}>{pkg.product.priceString}</Text>
                </Pressable>
              );
            })}

            {!auth.user ? (
              <View style={styles.banner} testID="pro-login-banner">
                <MaterialCommunityIcons name="account-alert" size={18} color={colors.warning} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text style={styles.bannerText}>Melde dich an, damit dein Abo an dein Konto gebunden ist und nie verloren geht.</Text>
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

            <Pressable
              testID="pro-buy-button"
              disabled={locked || !selected}
              onPress={onBuy}
              style={[styles.cta, (locked || !selected) && { opacity: 0.45 }]}
            >
              {sub.isPurchasing ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <Text style={styles.ctaText}>
                  {selected ? `${metaOf(selected).cta} – ${selected.product.priceString}` : "Plan wählen"}
                </Text>
              )}
            </Pressable>
            <Text style={styles.note}>
              {selected?.packageType === "LIFETIME"
                ? "Einmalige Zahlung. Kein Abo."
                : "Jederzeit kündbar. Automatische Verlängerung."}
            </Text>
            <Pressable testID="pro-restore-button" onPress={onRestore} disabled={sub.isRestoring} style={styles.linkBtn}>
              <Text style={styles.linkText}>{sub.isRestoring ? "Stelle wieder her…" : "Käufe wiederherstellen"}</Text>
            </Pressable>
            <Pressable testID="pro-legal-link" onPress={() => router.push("/legal")} style={styles.linkBtn}>
              <Text style={styles.noteSmall}>Impressum, Datenschutz & Nutzungsbedingungen</Text>
            </Pressable>
            {isTestStore ? <Text style={styles.noteSmall}>Vorschau: Käufe laufen im RevenueCat-Test-Store (simuliert).</Text> : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard} testID="pro-confirm-modal">
            <Text style={styles.modalTitle}>TEST-KAUF BESTÄTIGEN</Text>
            <Text style={styles.bannerText}>Simulierter Kauf über den RevenueCat-Test-Store: {confirm?.product.priceString}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable testID="pro-confirm-cancel" onPress={() => setConfirm(null)} style={[styles.restoreBtn, { flex: 1 }]}>
                <Text style={styles.restoreText}>ABBRECHEN</Text>
              </Pressable>
              <Pressable testID="pro-confirm-ok" onPress={() => confirm && doPurchase(confirm)} style={[styles.cta, { flex: 1, height: 44 }]}>
                <Text style={styles.ctaText}>KAUFEN</Text>
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
  headerRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg },
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
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginBottom: spacing.lg },
  logo: { width: 64, height: 64, borderRadius: 16 },
  brand: { fontFamily: fonts.displayBold, fontSize: 32, color: c.onSurface },
  brandSub: { fontFamily: fonts.textRegular, fontSize: 13, color: c.onSurfaceTertiary },
  title: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 38, color: c.onSurface, textAlign: "center", paddingHorizontal: spacing.lg },
  subtitle: {
    fontFamily: fonts.textRegular,
    fontSize: 15,
    color: c.onSurfaceTertiary,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  perks: { marginHorizontal: spacing.xl, marginTop: spacing.lg },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 4 },
  perkDivider: { borderTopWidth: 1, borderTopColor: c.divider },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: c.onSurface },
  activeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: c.success,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  activeText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.5, color: c.success },
  cardsRow: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  planCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
  },
  planCardOn: { borderColor: c.brandPrimary, borderWidth: 2, backgroundColor: c.brandTertiary },
  badge: {
    position: "absolute",
    top: -14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.brandPrimary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.textBold, fontSize: 11, color: c.onBrandPrimary },
  planLabel: { fontFamily: fonts.text, fontSize: 14, color: c.onSurface, marginTop: 4 },
  planPrice: { fontFamily: fonts.displayBold, fontSize: 26, color: c.onSurface },
  planPer: { fontFamily: fonts.textRegular, fontSize: 12, color: c.onSurfaceTertiary },
  planPerHighlight: { fontFamily: fonts.text, fontSize: 11, color: c.brandPrimary, textAlign: "center" },
  extraCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
  },
  extraPrice: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
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
  cta: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: fonts.textBold, fontSize: 17, color: c.onBrandPrimary },
  restoreBtn: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, color: c.onSurfaceSecondary },
  linkBtn: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  linkText: { fontFamily: fonts.text, fontSize: 13, color: c.brandPrimary },
  note: { fontFamily: fonts.textRegular, fontSize: 12, color: c.muted, textAlign: "center", lineHeight: 16 },
  noteSmall: { fontFamily: fonts.textRegular, fontSize: 11, color: c.muted, textAlign: "center", lineHeight: 16 },
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
