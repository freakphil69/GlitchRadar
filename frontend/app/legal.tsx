import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "IMPRESSUM",
    body:
      "Angaben gemäß § 5 DDG\n\nPhilipp Köhler\nKleiner Diebsteig 25\n18439 Stralsund\nDeutschland\n\nE-Mail: philippkohler940@gmail.com\n\nVerantwortlich für den Inhalt nach § 18 Abs. 2 MStV: Philipp Köhler, Anschrift wie oben.",
  },
  {
    title: "WERBEHINWEIS (AFFILIATE)",
    body:
      "Einige Links zu Shops sind sogenannte Affiliate-Links und als „ANZEIGE“ gekennzeichnet. Kaufst du über einen solchen Link ein, erhalten wir ggf. eine Provision vom Händler. Für dich ändert sich der Preis nicht.",
  },
  {
    title: "QUELLEN & HAFTUNG",
    body:
      "GlitchRadar zeigt Deals, Preisfehler und Gutscheincodes aus öffentlichen Deal-Feeds (mydealz.de, preisjaeger.at, dealdoktor.de, mytopdeals.net, sparhamster.at) mit Link zum Original-Beitrag. Wir übernehmen keine Gewähr für Richtigkeit, Verfügbarkeit oder Gültigkeit. Händler können Bestellungen bei offensichtlichen Preisfehlern stornieren. Risiko-Einschätzungen und Schritt-Pläne werden von einer KI erstellt und sind keine Rechts- oder Kaufberatung.",
  },
  {
    title: "DATENSCHUTZ",
    body:
      "Verantwortlicher: Philipp Köhler (Kontakt siehe Impressum).\n\nWelche Daten wir verarbeiten:\n• Ohne Konto werden Stash, Einstellungen und Abstimmungen nur lokal auf deinem Gerät gespeichert.\n• Mit Konto speichern wir E-Mail, Name, ggf. Profilbild (bei Google-Login), ein verschlüsseltes Passwort (bcrypt) und deinen Stash, um ihn geräteübergreifend zu synchronisieren (Art. 6 Abs. 1 lit. b DSGVO). Die Google-Anmeldung läuft über den Dienst Emergent Auth. Für die Löschung deines Kontos schreib eine E-Mail an die Adresse im Impressum.\n• Beim Laden der Deals sendet die App technisch notwendige Anfragen an unseren Server (IP-Adresse, Zeitpunkt). Diese Server-Logs dienen dem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).\n• Abstimmungen zu Codes werden anonym gezählt.\n• In-App-Abos werden über Apple App Store bzw. Google Play und den Dienstleister RevenueCat abgewickelt (Art. 6 Abs. 1 lit. b DSGVO). Wir erhalten keine Zahlungsdaten.\n• Beim Öffnen eines Shop- oder Quellen-Links gelten die Datenschutzbestimmungen des jeweiligen Anbieters.\n\nDeine Rechte: Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde, z. B. dem Landesbeauftragten für Datenschutz Mecklenburg-Vorpommern.",
  },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.headerRow}>
          <Pressable testID="legal-back-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>RECHTLICHES</Text>
        </View>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card} testID={`legal-section-${s.title.split(" ")[0].toLowerCase()}`}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
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
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: c.onSurface, letterSpacing: 1 },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: c.brandPrimary },
  body: { fontFamily: fonts.textRegular, fontSize: 13, lineHeight: 20, color: c.onSurfaceSecondary },
}));
