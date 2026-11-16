// Design tokens for this app — GlitchRadar.io, dark-only trading-terminal theme.
// Values come from /app/design_guidelines.json (Personality 7: Dark-First Utility DARK).
//
// The keys match the "color" block of /app/design_guidelines.json. A plain key is a
// background, and its `on` partner is the text or icon color that sits on top of it.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

// The app ships a single dark terminal scheme; the "light" slot holds it so every
// theme consumer always resolves to the obsidian palette.
const light = {
  // Surfaces: pure black canvas matching the GlitchRadar logo & splash.
  surface: "#000000", // primary canvas, most of every screen
  onSurface: "#FFFFFF", // text and icons on the canvas
  surfaceSecondary: "#0A0D12", // cards, sheets, list rows
  onSurfaceSecondary: "#E6EDF3", // text and icons on cards, sheets, rows
  surfaceTertiary: "#141920", // input backgrounds, chips, deepest nesting
  onSurfaceTertiary: "#8B949E", // text on inputs and chips; also muted text
  surfaceInverse: "#FFFFFF", // tooltips, snackbars, anything popping against the theme
  onSurfaceInverse: "#000000", // text and icons on the inverse surface
  muted: "#8B949E", // subdued text on surface: captions, timestamps, placeholders

  // Brand: signal orange (#FF6B00) — urgency, countdowns, primary CTAs.
  brand: "#FF6B00",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B00", // primary CTA, active tab indicator, selected states
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E05A00", // secondary CTA, pressed state
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#261200", // subtle brand fills, type badges, selected chips
  onBrandTertiary: "#FFB380",

  // Status: radar green (#22C55E) for live deals/success, semantic only.
  success: "#22C55E",
  onSuccess: "#FFFFFF",
  warning: "#D29922",
  onWarning: "#000000",
  error: "#F85149",
  onError: "#FFFFFF",
  info: "#388BFD",
  onInfo: "#FFFFFF",

  // Lines
  border: "#1F242D", // hairline outline, 1pt max: inputs, cards
  borderStrong: "#FF6B00", // focus rings, selected outlines
  divider: "#161B22", // subtle list separators
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`.
export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces on the scheme this app ships (dark terminal look).
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Typography — registered via the expo-font plugin in app.json.
export const fonts = {
  display: "BarlowCondensed-SemiBold", // headlines, prices
  displayBold: "BarlowCondensed-Bold",
  displayRegular: "BarlowCondensed-Regular",
  text: "Satoshi-Medium", // body
  textRegular: "Satoshi-Regular",
  textBold: "Satoshi-Bold",
  mono: "JetBrainsMono-Medium", // countdowns, ticker, codes, terminal log
} as const;

// Spacing + radius tokens from design_guidelines.json ("2xl" -> xxl, "3xl" -> xxxl).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
