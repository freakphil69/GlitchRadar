import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFacets } from "@/src/lib/queries";
import { useSettings, useUpdateSettings } from "@/src/lib/settings";
import type { Facet } from "@/src/lib/types";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

function toggle(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const facets = useFacets();
  const settings = useSettings();
  const update = useUpdateSettings();

  // Keep saved favourites visible even if they currently have no active deals.
  const withSaved = (list: Facet[] | undefined, saved: string[]): Facet[] => {
    const all = [...(list ?? [])];
    for (const s of saved) if (!all.some((f) => f.name === s)) all.push({ name: s, count: 0 });
    return all;
  };

  const renderGroup = (
    title: string,
    group: "shop" | "cat",
    options: Facet[],
    selected: string[],
    onToggle: (name: string) => void,
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.wrap}>
        {options.map((o) => {
          const on = selected.includes(o.name);
          return (
            <Pressable
              key={o.name}
              testID={`fav-${group}-${o.name}`}
              onPress={() => onToggle(o.name)}
              style={[styles.chip, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
            >
              {on ? <MaterialCommunityIcons name="check" size={14} color={colors.brandPrimary} /> : null}
              <Text style={[styles.chipText, on && { color: colors.onBrandTertiary }]} numberOfLines={1}>
                {o.name}
              </Text>
              <Text style={styles.count}>{o.count}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const activeCount = settings.favShops.length + settings.favCategories.length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="favorites-back-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>LIEBLINGS-SHOPS</Text>
        {activeCount > 0 ? (
          <Pressable
            testID="favorites-reset-button"
            onPress={() => update.mutate({ favShops: [], favCategories: [] })}
            hitSlop={8}
          >
            <Text style={styles.reset}>ZURÜCKSETZEN</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={styles.intro}>
          Wähle Shops und Kategorien. Das Radar zeigt dann nur noch passende Glitches. Ohne Auswahl siehst du alles.
        </Text>

        {facets.isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} />
        ) : facets.isError ? (
          <Pressable testID="favorites-retry" onPress={() => facets.refetch()} style={styles.retry}>
            <Text style={styles.reset}>LADEN FEHLGESCHLAGEN – ERNEUT VERSUCHEN</Text>
          </Pressable>
        ) : (
          <>
            {renderGroup("SHOPS", "shop", withSaved(facets.data?.shops, settings.favShops), settings.favShops, (n) =>
              update.mutate({ favShops: toggle(settings.favShops, n) }),
            )}
            {renderGroup(
              "KATEGORIEN",
              "cat",
              withSaved(facets.data?.categories, settings.favCategories),
              settings.favCategories,
              (n) => update.mutate({ favCategories: toggle(settings.favCategories, n) }),
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
  headerTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 24, color: c.onSurface, letterSpacing: 1 },
  reset: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: c.brandPrimary },
  intro: {
    fontFamily: fonts.textRegular,
    fontSize: 13,
    lineHeight: 19,
    color: c.onSurfaceTertiary,
    paddingHorizontal: spacing.lg,
  },
  retry: { alignItems: "center", padding: spacing.xl },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: c.muted },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: 14,
    maxWidth: "100%",
  },
  chipText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, flexShrink: 1 },
  count: { fontFamily: fonts.mono, fontSize: 10, color: c.muted },
}));
