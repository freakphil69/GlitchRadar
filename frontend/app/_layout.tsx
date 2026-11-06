import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppSplash } from "@/src/components/AppSplash";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider } from "@/src/lib/auth";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/lib/revenuecat";
import { queryClient } from "@/src/query-client";
import { bindNativeQueryFocus } from "@/src/lib/query-focus";
import { useTheme } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// RevenueCat SDK: configured exactly once at module scope, before any component mounts.
try {
  initializeRevenueCat();
} catch (err) {
  console.warn("RevenueCat unavailable:", err);
}

export default function RootLayout() {
  const { colors } = useTheme();
  useEffect(bindNativeQueryFocus, []);
  // Config plugin embeds fonts in native builds; this also loads them in Expo Go and on web.
  useFonts({
    "BarlowCondensed-Regular": require("@/assets/fonts/BarlowCondensed-Regular.ttf"),
    "BarlowCondensed-SemiBold": require("@/assets/fonts/BarlowCondensed-SemiBold.ttf"),
    "BarlowCondensed-Bold": require("@/assets/fonts/BarlowCondensed-Bold.ttf"),
    "Satoshi-Regular": require("@/assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Medium": require("@/assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-Bold": require("@/assets/fonts/Satoshi-Bold.ttf"),
    "JetBrainsMono-Medium": require("@/assets/fonts/JetBrainsMono-Medium.ttf"),
  });
  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app. GestureHandlerRootView must wrap the whole tree
  // or any gesture/swipe/drawer screen crashes in Expo Go.
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <AuthProvider>
            <KeyboardProvider>
              <StatusBar style="light" />
              <ToastProvider>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="glitch/[id]" options={{ presentation: "modal" }} />
                  <Stack.Screen name="scout" />
                  <Stack.Screen name="pro" options={{ presentation: "modal" }} />
                  <Stack.Screen name="login" options={{ presentation: "modal" }} />
                  <Stack.Screen name="hall-of-fame" />
                  <Stack.Screen name="favorites" />
                  <Stack.Screen name="share-savings" options={{ presentation: "modal" }} />
                  <Stack.Screen name="legal" />
                  <Stack.Screen name="faq" />
                </Stack>
                <AppSplash />
              </ToastProvider>
            </KeyboardProvider>
            </AuthProvider>
          </SubscriptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
