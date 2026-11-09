import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const DEVICE_ID_KEY = "glitchradar.pushUserId";

// Push works without login: anonymous devices get a stable local id, logged-in users their account id.
async function pushUserId(accountId?: string | null): Promise<string> {
  if (accountId) return accountId;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Ask permission (only if not decided yet / still askable) and register the native token. Never throws. */
export async function registerForPush(accountId?: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted" && current.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;
    const token = await Notifications.getDevicePushTokenAsync();
    await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: await pushUserId(accountId), platform: Platform.OS, device_token: token.data }),
    });
  } catch {
    // Expo Go / missing Firebase config: push simply stays off.
  }
}
