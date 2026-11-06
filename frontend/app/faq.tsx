import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Woher kommen die Deals?",
    a: "Aus öffentlichen Deal-Feeds wie mydealz, Preisjäger, DealDoktor, myTopDeals und Sparhamster. Jeder Fund verlinkt auf den Original-Beitrag. GlitchRadar erfindet keine Deals.",
  },
  {
    q: "Wie oft kommen neue Funde rein?",
    a: "Der Server prüft die Quellen regelmäßig im Hintergrund automatisch. Mit dem Scout kannst du die Quellen zusätzlich manuell abfragen.",
  },
  {
    q: "Was bedeuten Risiko und Trefferquote?",
    a: "Das ist eine Einschätzung, wie wahrscheinlich das Einlösen klappt und wie hoch das Storno-Risiko ist. Sie wird meist von einer KI erstellt, in Ausnahmefällen über einfache Regeln je nach Deal-Art. Es ist keine Garantie – prüf den Preis immer selbst im Shop.",
  },
  {
    q: "Wird ein Preisfehler garantiert geliefert?",
    a: "Nein. Shops dürfen Bestellungen mit offensichtlichen Preisfehlern oft stornieren. Bestell nur, was du auch zum normalen Preis gebrauchen könntest, und mach am besten einen Screenshot vom Preis.",
  },
  {
    q: "Wie entsteht der Schritt-für-Schritt-Plan?",
    a: "Beim ersten Öffnen eines Deals erstellt der KI-Analyst einen Plan. Er wird gespeichert, damit alle danach sofort denselben Plan sehen. Deshalb lädt er beim zweiten Mal schneller.",
  },
  {
    q: "Warum ändert sich der Plan nicht, wenn ich die Seite neu lade?",
    a: "Mit Absicht: Ein Neuladen zeigt den gespeicherten Plan an und startet keine neue Analyse. So bleibt die App schnell und für alle gleich.",
  },
  {
    q: "Ein Code oder Deal funktioniert nicht mehr – was tun?",
    a: "Melde ihn auf der Detailseite als abgelaufen oder stimme beim Code ab. Das hilft allen anderen Nutzern.",
  },
  {
    q: "Was ist der Stash?",
    a: "Deine Merkliste. Markierst du einen Deal dort als „gesichert“, zählt die Ersparnis in deiner Statistik im Terminal. Ohne Konto bleibt der Stash nur auf deinem Gerät, mit Konto wird er synchronisiert.",
  },
  {
    q: "Was bringt PRO?",
    a: "Unbegrenzte manuelle Scans. Kostenlos sind 3 manuelle Scans pro Tag. Neue Nutzer bekommen zum Start 3 Tage PRO gratis. Die aktuellen Preise siehst du in der PRO-Ansicht.",
  },
  {
    q: "Wie kündige ich PRO oder stelle Käufe wieder her?",
    a: "Abos verwaltest und kündigst du direkt im Google Play Store bzw. App Store. Nach einem Gerätewechsel tippst du in der PRO-Ansicht auf „Käufe wiederherstellen“.",
  },
  {
    q: "Verdient GlitchRadar an meinen Käufen?",
    a: "Manche Shop-Links sind Affiliate-Links und als „ANZEIGE“ gekennzeichnet. Kaufst du darüber, bekommen wir ggf. eine kleine Provision. Für dich ändert sich der Preis dadurch nicht.",
  },
];

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.headerRow}>
          <Pressable testID="faq-back-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>FAQ</Text>
        </View>
        <Text style={styles.intro}>Häufige Fragen zu GlitchRadar. Tippe auf eine Frage für die Antwort.</Text>
        {FAQ.map((item, i) => (
          <Pressable
            key={item.q}
            testID={`faq-item-${i}`}
            onPress={() => setOpen(open === i ? null : i)}
            style={styles.card}
          >
            <View style={styles.qRow}>
              <Text style={styles.question}>{item.q}</Text>
              <MaterialCommunityIcons
                name={open === i ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.brandPrimary}
              />
            </View>
            {open === i ? <Text style={styles.body}>{item.a}</Text> : null}
          </Pressable>
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
  question: { fontFamily: fonts.displayBold, fontSize: 15, lineHeight: 21, color: c.onSurface, flex: 1 },
  qRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  intro: { fontFamily: fonts.textRegular, fontSize: 13, lineHeight: 20, color: c.onSurfaceSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  body: { fontFamily: fonts.textRegular, fontSize: 13, lineHeight: 20, color: c.onSurfaceSecondary },
}));
