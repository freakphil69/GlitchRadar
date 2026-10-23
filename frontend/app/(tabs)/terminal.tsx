import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipRow } from "@/src/components/ChipRow";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/lib/auth";
import { useSubscription } from "@/src/lib/revenuecat";
import { useStashActions } from "@/src/lib/stash";
import { useSettings, useUpdateSettings } from "@/src/lib/settings";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DISCOUNT_CHIPS = [
  { key: "0", label: "ALLE" },
  { key: "50", label: "50 %+" },
  { key: "70", label: "70 %+" },
  { key: "80", label: "80 %+" },
];

const MODEL_STACK = [
  { role: "QUELLEN", model: "MYDEALZ + PREISJÄGER + DEALDOKTOR", job: "Echte Funde aus Live-Feeds, alle 10 Min" },
  { role: "SCORING", model: "GEMINI 3 FLASH", job: "Bewertet Risiko + Trefferquote" },
  { role: "ANALYST", model: "CLAUDE SONNET 5.5", job: "Schritt-für-Schritt-Pläne zu echten Funden" },
];

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const settings = useSettings();
  const update = useUpdateSettings();
  const stashActions = useStashActions();
  const { isSubscribed } = useSubscription();
  const auth = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const onLogout = async () => {
    await auth.logout();
    toast("Abgemeldet", "info");
  };

  const onClearStash = () => {
    stashActions.clear.mutate();
    toast("Stash geleert", "info");
  };

  const links = [
    { id: "pro", icon: "crown", title: isSubscribed ? "PRO ist aktiv" : "GlitchRadar PRO holen", text: "Unbegrenzte Scans und KI-Pläne", to: "/pro" },
    { id: "hof", icon: "trophy", title: "Hall of Fame", text: "Die größten echten Preisfehler aller Zeiten", to: "/hall-of-fame" },
    { id: "scout", icon: "radar", title: "Scout & Scan-Protokoll", text: "Live-Quellen manuell abfragen", to: "/scout" },
    { id: "legal", icon: "scale-balance", title: "Impressum & Datenschutz", text: "Rechtliches und Werbehinweis", to: "/legal" },
  ] as const;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: bottomChrome + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>TERMINAL</Text>
        <Text style={styles.subtitle}>Scanner-Konfiguration und System-Info.</Text>

        <View style={[styles.card, { marginBottom: spacing.md }]} testID="terminal-account-card">
          {auth.user ? (
            <View style={styles.row}>
              <MaterialCommunityIcons name="account-circle" size={28} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{auth.user.name || auth.user.email}</Text>
                <Text style={styles.rowText} numberOfLines={1}>{auth.user.email} · Stash wird synchronisiert</Text>
              </View>
              <Pressable testID="terminal-logout-button" onPress={onLogout} style={styles.dangerButton} hitSlop={6}>
                <Text style={styles.dangerButtonText}>ABMELDEN</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable testID="terminal-login-button" onPress={() => router.push("/login")} style={styles.row}>
              <MaterialCommunityIcons name="account-plus" size={24} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Anmelden oder registrieren</Text>
                <Text style={styles.rowText}>Google oder E-Mail – für PRO und Stash-Sync</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          )}
          <View style={styles.divider} />
          <Pressable testID="terminal-plan-banner" onPress={() => router.push("/pro")} style={styles.row}>
            <MaterialCommunityIcons
              name={isSubscribed ? "crown" : "crown-outline"}
              size={22}
              color={isSubscribed ? colors.success : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{isSubscribed ? "PRO aktiv" : "Free-Plan"}</Text>
              <Text style={styles.rowText} numberOfLines={2}>
                {isSubscribed
                  ? auth.user
                    ? `An dein Konto gebunden: ${auth.user.email}`
                    : "Auf diesem Gerät aktiv – melde dich an, um PRO überall zu nutzen"
                  : "Begrenzte Scans pro Tag – PRO schaltet alles frei"}
              </Text>
              {auth.identityError ? (
                <Text testID="terminal-identity-error" style={styles.errorText} numberOfLines={2}>
                  PRO-Konto konnte nicht verknüpft werden. Bitte später erneut versuchen.
                </Text>
              ) : null}
            </View>
            <Text style={[styles.planBadge, isSubscribed && styles.planBadgePro]}>{isSubscribed ? "PRO" : "FREE"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {links.map((l, idx) => (
            <View key={l.id}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable testID={`terminal-link-${l.id}`} onPress={() => router.push(l.to)} style={styles.row}>
                <MaterialCommunityIcons name={l.icon} size={20} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.title}</Text>
                  <Text style={styles.rowText}>{l.text}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>FILTER</Text>
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Mindest-Rabatt im Radar</Text>
          <Text style={styles.rowText}>Blendet kleinere Deals aus, damit nur harte Glitches durchkommen.</Text>
          <ChipRow
            options={DISCOUNT_CHIPS}
            value={String(settings.minDiscount)}
            onChange={(k) => update.mutate({ minDiscount: Number(k) })}
          />
        </View>

        <Text style={styles.sectionTitle}>QUELLEN & MODELLE</Text>
        <View style={styles.card}>
          {MODEL_STACK.map((m, idx) => (
            <View key={m.role} style={{ gap: 2 }}>
              {idx > 0 && <View style={styles.divider} />}
              <View style={styles.modelRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{m.model}</Text>
                  <Text style={styles.rowText}>{m.job}</Text>
                </View>
                <Text style={styles.modelRole}>{m.role}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>SYSTEM</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Stash leeren</Text>
              <Text style={styles.rowText}>Alle Beobachtungen und Einträge lokal löschen.</Text>
            </View>
            <Pressable testID="stash-clear-button" onPress={onClearStash} style={styles.dangerButton} hitSlop={6}>
              <MaterialCommunityIcons name="delete-outline" size={16} color={colors.error} />
              <Text style={styles.dangerButtonText}>LEEREN</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Version</Text>
            <Text style={styles.modelRole}>GLITCHRADAR v1.0.0</Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>HINWEIS</Text>
          <Text style={styles.disclaimerText}>
            Funde stammen aus öffentlichen Deal-Feeds (mydealz, Preisjäger, DealDoktor) — immer mit Link zum Original.
            Shops können Preisfehler stornieren, rechne immer damit. Nutze Käuferschutz, mache Screenshots
            und bestelle nur, was du wirklich brauchst.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.surface,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    color: c.onSurface,
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontFamily: fonts.textRegular,
    fontSize: 13,
    color: c.muted,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: c.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTitle: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: c.onSurface,
  },
  rowText: {
    fontFamily: fonts.textRegular,
    fontSize: 12,
    lineHeight: 17,
    color: c.onSurfaceTertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: c.divider,
    marginVertical: spacing.md,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  modelRole: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: c.onBrandTertiary,
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 36,
  },
  errorText: {
    fontFamily: fonts.textRegular,
    fontSize: 12,
    color: c.error,
    marginTop: 4,
  },
  planBadge: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: c.muted,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  planBadgePro: {
    color: c.success,
    borderColor: c.success,
  },
  dangerButtonText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: c.error,
  },
  disclaimer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  disclaimerTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: c.onBrandTertiary,
  },
  disclaimerText: {
    fontFamily: fonts.textRegular,
    fontSize: 12,
    lineHeight: 18,
    color: c.onSurfaceSecondary,
  },
}));
