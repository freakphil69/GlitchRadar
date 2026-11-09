import { memo } from "react";
import { Image } from "react-native";

// Bundled, size-limited images only: no remote URLs, timers or animation runtime.
const SOURCES = {
  neutral: require("@/assets/images/mascot/neutral.webp"),
  proud: require("@/assets/images/mascot/proud.webp"),
  offer: require("@/assets/images/mascot/offer.webp"),
  crossed: require("@/assets/images/mascot/crossed.webp"),
} as const;

export const Mascot = memo(function Mascot({
  pose = "neutral",
  width = 120,
  height = 140,
}: {
  pose?: keyof typeof SOURCES;
  width?: number;
  height?: number;
}) {
  return (
    <Image
      testID={`mascot-${pose}`}
      source={SOURCES[pose]}
      style={{ width, height, flexShrink: 0 }}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});
