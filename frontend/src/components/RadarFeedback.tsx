import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { apiGet, apiPost } from "@/src/lib/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Bewertung im Radar-Stil: 5 Signale statt Sterne. Kostet keine KI.
const LEVELS = ["", "KEIN SIGNAL", "SCHWACHES SIGNAL", "SOLIDER FUND", "STARKER FUND", "VOLLTREFFER"];
const TAGS = ["Funde", "Geschwindigkeit", "Design", "KI-Pläne", "Codes", "Preis", "Bug", "Idee"];

type Summary = { average: number | null; count: number };

export function RadarFeedback() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadSummary = () => {
    apiGet<Summary>("/feedback/summary").then(setSummary).catch(() => {});
  };
  useEffect(loadSummary, []);

  const pick = (n: number) => {
    Haptics.selectionAsync().catch(() => {});
    setRating(n);
    setError(null);
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const send = async () => {
    if (!rating || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiPost("/feedback", { rating, comment: comment.trim(), tags });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSent(true);
      loadSummary();
    } catch (e) {
      setError((e as Error)?.message || "Senden fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSent(false);
    setRating(0);
    setTags([]);
    setComment("");
  };

  return (
    <View style={styles.card} testID="feedback-card">
      <Text style={styles.sectionTitle}>DEIN SIGNAL AN UNS</Text>
      <Text style={styles.headline}>Wie gefällt dir GlitchRadar?</Text>

      {summary && summary.count >= 3 && summary.average !== null ? (
        <Text style={styles.summary} testID="feedback-summary">
          Ø {summary.average.toFixed(1).replace(".", ",")} von 5 Signalen · {summary.count} Bewertungen
        </Text>
      ) : null}

      {sent ? (
        <View style={styles.thanks} testID="feedback-thanks">
          <MaterialCommunityIcons name="radar" size={40} color={colors.brandPrimary} />
          <Text style={styles.thanksTitle}>SIGNAL EMPFANGEN</Text>
          <Text style={styles.body}>Danke! Lob und Kritik lesen wir wirklich – beides macht die App besser.</Text>
          <Pressable testID="feedback-again" onPress={reset} hitSlop={8}>
            <Text style={styles.link}>Noch etwas loswerden?</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.signalRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = n <= rating;
              return (
                <Pressable
                  key={n}
                  testID={`feedback-signal-${n}`}
                  onPress={() => pick(n)}
                  hitSlop={6}
                  accessibilityLabel={`${n} von 5 Signalen`}
                  style={[styles.signal, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + "22" }]}
                >
                  <MaterialCommunityIcons name="radar" size={26} color={on ? colors.brandPrimary : colors.muted} />
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.level, { color: rating ? colors.brandPrimary : colors.muted }]} testID="feedback-level">
            {rating ? LEVELS[rating] : "TIPPE AUF EIN SIGNAL"}
          </Text>

          {rating ? (
            <>
              <Text style={styles.subTitle}>WORUM GEHT’S? (OPTIONAL)</Text>
              <View style={styles.tagRow}>
                {TAGS.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <Pressable
                      key={t}
                      testID={`feedback-tag-${t}`}
                      onPress={() => toggleTag(t)}
                      style={[styles.tag, on && { borderColor: colors.brandPrimary }]}
                    >
                      <Text style={[styles.tagText, on && { color: colors.brandPrimary }]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                testID="feedback-comment"
                value={comment}
                onChangeText={setComment}
                placeholder={rating >= 4 ? "Was gefällt dir besonders?" : "Was sollen wir besser machen?"}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={1000}
                style={styles.input}
              />
              <Text style={styles.hint}>{comment.length}/1000 · Bitte keine persönlichen Daten eintragen.</Text>
              {error ? <Text style={[styles.hint, { color: colors.error }]}>{error}</Text> : null}
              <Pressable testID="feedback-send" onPress={send} disabled={sending} style={styles.button}>
                {sending ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.buttonText}>SIGNAL SENDEN</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: c.brandPrimary },
  headline: { fontFamily: fonts.displayBold, fontSize: 22, color: c.onSurface },
  summary: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceSecondary },
  signalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  signal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  level: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, textAlign: "center", marginTop: spacing.xs },
  subTitle: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: c.muted, marginTop: spacing.sm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  tagText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceSecondary },
  input: {
    minHeight: 96,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    padding: spacing.md,
    color: c.onSurface,
    fontFamily: fonts.text,
    fontSize: 15,
    textAlignVertical: "top",
    marginTop: spacing.sm,
  },
  hint: { fontFamily: fonts.textRegular, fontSize: 12, color: c.muted },
  button: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonText: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: 1, color: c.onBrandPrimary },
  thanks: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  thanksTitle: { fontFamily: fonts.displayBold, fontSize: 20, letterSpacing: 1, color: c.brandPrimary },
  body: { fontFamily: fonts.textRegular, fontSize: 13, lineHeight: 20, color: c.onSurfaceSecondary, textAlign: "center" },
  link: { fontFamily: fonts.text, fontSize: 13, color: c.brandPrimary },
}));
