import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, LogBox, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppSplash } from "@/src/components/AppSplash";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider, useAuth } from "@/src/lib/auth";
import { registerForPush } from "@/src/lib/push";
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

// Push: foreground display + Android channel must exist before any push arrives (native only).
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Glitch-Alarm",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function openPushTarget(router: ReturnType<typeof useRouter>, data: Record<string, unknown> | undefined) {
  const url = (data?.deeplink || data?.action_url) as string | undefined;
  if (!url) return;
  if (url.startsWith("http")) Linking.openURL(url);
  else router.push(url as never);
}

// Registers the device for Glitch-Alarm pushes on every app open and after login (tokens rotate).
function PushRegistrar() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    registerForPush(user?.user_id);
  }, [user?.user_id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tapSub = Notifications.addNotificationResponseReceivedListener((r) =>
      openPushTarget(router, r.notification.request.content.data),
    );
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) openPushTarget(router, r.notification.request.content.data);
    });
    // Denied for good: nudge at most once a week towards the system settings.
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const last = await AsyncStorage.getItem("pushNudgeAt");
      if (last && Date.now() - Number(last) <= 7 * 86_400_000) return;
      const stamp = () => AsyncStorage.setItem("pushNudgeAt", String(Date.now()));
      Alert.alert(
        "Glitch-Alarm verpassen?",
        "Erlaube Benachrichtigungen, damit wir dich bei frischen Preisfehlern sofort anpingen.",
        [
          { text: "Später", style: "cancel", onPress: stamp },
          { text: "Einstellungen öffnen", onPress: () => stamp().then(() => Linking.openSettings()) },
        ],
      );
    })();
    return () => tapSub.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  const { colors } = useTheme();
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
                </Stack>
                <AppSplash />
                <PushRegistrar />
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
