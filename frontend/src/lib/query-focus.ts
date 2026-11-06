import { focusManager } from "@tanstack/react-query";
import { AppState, Platform, type AppStateStatus } from "react-native";

// React Query already handles document visibility on web. Native needs AppState
// so periodic reads pause in the background and stale data refreshes on return.
export function bindNativeQueryFocus() {
  if (Platform.OS === "web") return;

  const update = (state: AppStateStatus) => focusManager.setFocused(state === "active");
  if (AppState.currentState) update(AppState.currentState);
  const subscription = AppState.addEventListener("change", update);
  return () => {
    subscription.remove();
    focusManager.setFocused(undefined);
  };
}
