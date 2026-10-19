import { Platform } from "react-native";

// iOS 26+ renders true native (liquid glass) tabs; everything else falls back to
// the classic JS `<Tabs>` from expo-router.
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
