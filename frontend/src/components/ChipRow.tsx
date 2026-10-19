import { Pressable, ScrollView, Text, View } from "react-native";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export interface ChipOption {
  key: string;
  label: string;
}

export function ChipRow({ options, value, onChange }: { options: ChipOption[]; value: string; onChange: (key: string) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.rowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={o.key}
              testID={`chip-${o.key}`}
              onPress={() => onChange(o.key)}
              style={[styles.chip, selected && { borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary }]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.onBrandTertiary : colors.onSurfaceTertiary },
                ]}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  rowWrap: {
    height: 56,
    justifyContent: "center",
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  chip: {
    flexShrink: 0,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.text,
    letterSpacing: 0.8,
  },
}));
