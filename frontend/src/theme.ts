// Original mascot-era dark terminal palette.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
export type ColorScheme = "light" | "dark";
const light = {
  surface: "#0D1117", onSurface: "#E6EDF3",
  surfaceSecondary: "#161B22", onSurfaceSecondary: "#C9D1D9",
  surfaceTertiary: "#21262D", onSurfaceTertiary: "#8B949E",
  surfaceInverse: "#F0F6FC", onSurfaceInverse: "#0D1117", muted: "#8B949E",
  brand: "#FF5722", onBrand: "#FFFFFF",
  brandPrimary: "#FF5722", onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E64A19", onBrandSecondary: "#FFFFFF",
  brandTertiary: "#2A1713", onBrandTertiary: "#FFAB91",
  success: "#238636", onSuccess: "#FFFFFF",
  warning: "#D29922", onWarning: "#0D1117",
  error: "#F85149", onError: "#FFFFFF",
  info: "#388BFd", onInfo: "#FFFFFF",
  border: "#30363D", borderStrong: "#FF5722", divider: "#21262D",
};
export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };
export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);
export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
export const fonts = {
  display: "BarlowCondensed-SemiBold", displayBold: "BarlowCondensed-Bold", displayRegular: "BarlowCondensed-Regular",
  text: "Satoshi-Medium", textRegular: "Satoshi-Regular", textBold: "Satoshi-Bold", mono: "JetBrainsMono-Medium",
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
