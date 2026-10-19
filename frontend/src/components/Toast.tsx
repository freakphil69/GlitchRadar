import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { fonts, makeStyles, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";

interface ToastData {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastKind, string> = {
  success: "check-circle",
  error: "alert-circle",
  info: "information",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      <View style={{ flex: 1 }}>{children}</View>
      {toast ? <ToastItem key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: ToastData }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const bg =
    toast.kind === "success" ? colors.success : toast.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = toast.kind === "info" ? colors.onSurfaceInverse : colors.onError;

  return (
    <Animated.View
      testID="toast"
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.toast, { top: insets.top + 8, backgroundColor: bg, borderColor: fg + "33" }]}
      pointerEvents="none"
    >
      <MaterialCommunityIcons name={ICONS[toast.kind]} size={18} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.text,
    lineHeight: 18,
  },
}));
