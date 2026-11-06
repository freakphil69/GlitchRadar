// One QueryClient for the whole app; the provider in app/_layout.tsx uses
// this instance. Import it for cache calls outside components, for example
// queryClient.invalidateQueries or setQueryData in websocket or push
// handlers; inside components useQueryClient() returns this same instance.
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient } from "@tanstack/react-query";

// Pause polling while the app is in the background (saves battery & data on phones).
if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener("change", (s) => handleFocus(s === "active"));
    return () => sub.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000 } },
});
