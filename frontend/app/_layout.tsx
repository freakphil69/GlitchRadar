import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider } from "@/src/lib/auth";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/lib/revenuecat";
import { queryClient } from "@/src/query-client";
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
                </Stack>
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
