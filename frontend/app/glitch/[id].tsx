import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipRow } from "@/src/components/ChipRow";
import { Countdown } from "@/src/components/Countdown";
import { useToast } from "@/src/components/Toast";
import { fmtDateTime, fmtMoney, fmtPrice } from "@/src/lib/format";
import { useEnrich, useGlitch, useReportDead } from "@/src/lib/queries";
import { useIsStashed, useStashActions } from "@/src/lib/stash";
import { RISK_LABELS, TYPE_LABELS } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SECTION_CHIPS = [
  { key: "steps", label: "SCHRITTE" },
  { key: "risk", label: "RISIKO" },
  { key: "details", label: "DETAILS" },
];

export default function GlitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();

  const q = useGlitch(id ?? "");
  const enrich = useEnrich(id ?? "");
  const dead = useReportDead();
  const stashed = useIsStashed(id);
  const actions = useStashActions();
  const [section, setSection] = useState("steps");
  const autoEnrichRef = useRef<string | null>(null);

  const glitch = q.data;

  useEffect(() => {
    if (!glitch || glitch.enriched) return;
    if (autoEnrichRef.current === glitch.id || enrich.isPending) return;
    autoEnrichRef.current = glitch.id;
    enrich.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glitch?.id, glitch?.enriched]);

  const retryEnrich = () => {
    enrich.reset();
    autoEnrichRef.current = null;
  };

  const onCta = async () => {
    if (!glitch) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (glitch.coupon_code) {
      await Clipboard.setStringAsync(glitch.coupon_code);
      toast(`Code ${glitch.coupon_code} kopiert`, "success");
    }
    if (glitch.url) {
      WebBrowser.openBrowserAsync(glitch.url);
    } else if (!glitch.coupon_code) {
      toast("Kein Shop-Link vorhanden", "info");
    }
  };

  const onStash = () => {
    if (!glitch) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stashed) {
      actions.remove.mutate(glitch.id);
      toast("Aus dem Stash entfernt", "info");
    } else {
      actions.save.mutate(glitch);
      toast("Im Stash gesichert", "success");
    }
  };

  const onReportDead = () => {
    if (!glitch) return;
    dead.mutate(glitch.id, {
      onSuccess: () => {
        toast("Glitch als tot gemeldet", "info");
        router.back();
      },
      onError: () => toast("Melden fehlgeschlagen", "error"),
    });
  };

  if (q.isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" testID="detail-loading" />
        <Text style={styles.stateText}>DEKRYPTIERE GLITCH-PROTOKOLL…</Text>
      </View>
    );
  }

  if (q.isError || !glitch) {
    return (
      <View style={[styles.screen, styles.center]}>
        <MaterialCommunityIcons name="file-question" size={40} color={colors.error} />
        <Text style={styles.stateText}>{(q.error as Error)?.message ?? "Glitch nicht gefunden."}</Text>
        <Pressable testID="detail-back-button" onPress={() => router.back()} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>ZURÜCK</Text>
        </Pressable>
      </View>
    );
  }

  const riskColor =
    glitch.risk_level === "low" ? colors.success : glitch.risk_level === "medium" ? colors.warning : colors.error;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 180 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable testID="detail-close-button" onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[glitch.type]}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[styles.sourceBadge, { borderColor: riskColor }]}>
            <Text style={[styles.sourceText, { color: riskColor }]}>{glitch.source_label}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.shop}>{glitch.shop} · {glitch.category.toUpperCase()}</Text>
          <Text style={styles.title}>{glitch.title}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceGlitched}>{fmtMoney(glitch.glitched_price)}</Text>
            <Text style={styles.priceOriginal}>{fmtPrice(glitch.original_price)} €</Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{glitch.discount_pct}%</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <Countdown expiresAt={glitch.expires_at} size="lg" />
            <View style={styles.successBox}>
              <Text style={styles.successLabel}>TREFFERQUOTE</Text>
              <Text style={[styles.successValue, { color: riskColor }]}>{glitch.success_rate}%</Text>
            </View>
          </View>

          {glitch.status !== "active" ? (
            <View style={styles.deadBanner} testID="detail-expired-banner">
              <MaterialCommunityIcons name="skull-outline" size={16} color={colors.error} />
              <Text style={styles.deadText}>DIESER GLITCH IST NICHT MEHR AKTIV</Text>
            </View>
          ) : null}
        </View>

        {glitch.coupon_code ? (
          <View style={styles.codeBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLabel}>CODE</Text>
              <Text style={styles.codeValue}>{glitch.coupon_code}</Text>
            </View>
            <Pressable
              testID="detail-copy-button"
              onPress={onCta}
              style={styles.copyBtn}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="content-copy" size={16} color={colors.onBrandTertiary} />
              <Text style={styles.copyText}>KOPIEREN</Text>
            </Pressable>
          </View>
        ) : null}

        <ChipRow options={SECTION_CHIPS} value={section} onChange={setSection} />

        {section === "steps" ? (
          <View style={styles.sectionCard}>
            {enrich.isPending ? (
              <View style={styles.center} testID="enrich-loading">
                <ActivityIndicator color={colors.brandPrimary} size="large" />
                <Text style={styles.stateText}>ANALYST (CLAUDE SONNET 5.5) ENTSCHLÜSSELT DEN PLAN…</Text>
              </View>
            ) : enrich.isError ? (
              <View style={styles.center} testID="enrich-error">
                <MaterialCommunityIcons name="alert-circle" size={32} color={colors.error} />
                <Text style={styles.stateText}>{(enrich.error as Error)?.message}</Text>
                <Pressable testID="enrich-retry-button" onPress={retryEnrich} style={styles.stateButton}>
                  <Text style={styles.stateButtonText}>ERNEUT VERSUCHEN</Text>
                </Pressable>
              </View>
            ) : glitch.enriched && glitch.instructions.length > 0 ? (
              <>
                {glitch.instructions.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <Text style={styles.stepNum}>{idx + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
                {glitch.tips.length > 0 ? (
                  <>
                    <Text style={styles.subTitle}>PROFI-TIPPS</Text>
                    {glitch.tips.map((tip, idx) => (
                      <View key={idx} style={styles.tipRow}>
                        <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={colors.warning} />
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <Text style={styles.stateText}>Kein Plan verfügbar.</Text>
            )}
          </View>
        ) : section === "risk" ? (
          <View style={styles.sectionCard}>
            <View style={styles.riskRow}>
              <Text style={styles.subTitle}>RISIKO</Text>
              <View style={[styles.riskBadge, { borderColor: riskColor }]}>
                <Text style={[styles.riskBadgeText, { color: riskColor }]}>{RISK_LABELS[glitch.risk_level]}</Text>
              </View>
            </View>
            <View style={styles.successBarBg}>
              <View
                style={{
                  width: `${Math.min(100, Math.max(0, glitch.success_rate))}%`,
                  height: "100%",
                  borderRadius: radius.pill,
                  backgroundColor: riskColor,
                }}
              />
            </View>
            <Text style={styles.bodyText}>{glitch.risk_note || "Keine Risikobewertung vorhanden."}</Text>
            {glitch.risk_analysis ? <Text style={styles.bodyText}>{glitch.risk_analysis}</Text> : null}
            {glitch.time_window_note ? (
              <View style={styles.tipRow}>
                <MaterialCommunityIcons name="clock-fast" size={14} color={colors.info} />
                <Text style={styles.tipText}>{glitch.time_window_note}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.subTitle}>WAS PASIERT IST</Text>
            <Text style={styles.bodyText}>{glitch.description}</Text>
            <Text style={[styles.subTitle, { marginTop: spacing.md }]}>WARUM ES FUNKTIONIERT</Text>
            <Text style={styles.bodyText}>{glitch.why_it_works || "—"}</Text>
            <Text style={[styles.subTitle, { marginTop: spacing.md }]}>PROTOKOLL</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>SHOP</Text>
              <Text style={styles.metaValue}>{glitch.shop}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>ERSTELLT</Text>
              <Text style={styles.metaValue}>{fmtDateTime(glitch.created_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>LÄUFT AB</Text>
              <Text style={styles.metaValue}>{fmtDateTime(glitch.expires_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>QUELLE</Text>
              <Text style={styles.metaValue}>
                {glitch.source_label}
                {glitch.scout_model ? ` · ${glitch.scout_model.toUpperCase()}` : ""}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            testID="detail-stash-toggle"
            onPress={onStash}
            style={[styles.secondaryBtn, stashed && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
          >
            <MaterialCommunityIcons
              name={stashed ? "archive-check" : "archive-plus"}
              size={18}
              color={stashed ? colors.onBrandTertiary : colors.onSurfaceSecondary}
            />
          </Pressable>
          <Pressable testID="detail-report-dead" onPress={onReportDead} style={[styles.secondaryBtn, { paddingHorizontal: spacing.md }]}>
            <MaterialCommunityIcons name="skull-outline" size={18} color={colors.error} />
            <Text style={[styles.secondaryText, { color: colors.error }]}>TOT MELDEN</Text>
          </Pressable>
        </View>
        <Pressable testID="detail-cta-button" onPress={onCta} style={styles.ctaButton}>
          <Text style={styles.ctaText}>
            {glitch.coupon_code ? "CODE KOPIEREN & SHOP ÖFFNEN" : "SHOP ÖFFNEN"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.surface,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    color: c.onBrandTertiary,
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceText: {
    fontSize: 9,
    fontFamily: fonts.mono,
    letterSpacing: 1,
  },
  hero: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  shop: {
    fontSize: 12,
    fontFamily: fonts.text,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 33,
    color: c.onSurface,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  priceGlitched: {
    fontFamily: fonts.displayBold,
    fontSize: 48,
    color: c.onSurface,
    fontVariant: ["tabular-nums"],
  },
  priceOriginal: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: c.muted,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: c.error,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  discountText: {
    fontSize: 14,
    fontFamily: fonts.mono,
    color: c.onError,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  successBox: {
    alignItems: "flex-end",
    gap: 2,
  },
  successLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.onSurfaceTertiary,
  },
  successValue: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    fontVariant: ["tabular-nums"],
  },
  deadBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.error + "22",
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deadText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: c.error,
  },
  codeBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  codeLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.onSurfaceTertiary,
  },
  codeValue: {
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 2,
    color: c.onBrandTertiary,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    height: 36,
  },
  copyText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: c.onBrandTertiary,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: c.brandTertiary,
    color: c.onBrandTertiary,
    fontFamily: fonts.mono,
    fontSize: 12,
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 20,
    color: c.onSurface,
  },
  subTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: c.muted,
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.textRegular,
    fontSize: 13,
    lineHeight: 19,
    color: c.onSurfaceSecondary,
  },
  bodyText: {
    fontFamily: fonts.textRegular,
    fontSize: 13,
    lineHeight: 20,
    color: c.onSurfaceSecondary,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riskBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  riskBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  successBarBg: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  metaKey: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: c.muted,
  },
  metaValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: c.onSurfaceSecondary,
    textAlign: "right",
    flexShrink: 1,
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: 12,
  },
  secondaryText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  ctaButton: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: c.onBrandPrimary,
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  stateText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: c.onSurfaceTertiary,
    textAlign: "center",
  },
  stateButton: {
    backgroundColor: c.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stateButtonText: {
    color: c.onBrandPrimary,
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
  },
}));
