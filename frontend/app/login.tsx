import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/lib/auth";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  // Login is optional: once a user exists, close this screen.
  useEffect(() => {
    if (auth.user) {
      toast(`Angemeldet als ${auth.user.email}`, "success");
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

  const submit = async () => {
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError("Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await auth.loginEmail(email.trim(), password);
      else await auth.register(email.trim(), password, name.trim() || undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await auth.loginGoogle();
      if (!ok && Platform.OS !== "web") setError("Google-Anmeldung abgebrochen");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (Platform.OS !== "web") setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + spacing.xl }}
      >
        <View style={styles.headerRow}>
          <Pressable testID="login-close-button" onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <Text style={styles.kicker}>GLITCHRADAR-KONTO</Text>
        <Text style={styles.title}>{mode === "login" ? "ANMELDEN" : "KONTO ERSTELLEN"}</Text>
        <Text style={styles.subtitle}>Für PRO und um deinen Stash auf allen Geräten zu behalten.</Text>

        <View style={styles.form}>
          <Pressable testID="login-google-button" onPress={google} disabled={busy} style={styles.googleBtn}>
            <MaterialCommunityIcons name="google" size={20} color="#1F1F1F" />
            <Text style={styles.googleText}>Weiter mit Google</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ODER MIT E-MAIL</Text>
            <View style={styles.orLine} />
          </View>

          {mode === "register" ? (
            <TextInput
              testID="login-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Name (optional)"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          ) : null}
          <TextInput
            ref={emailRef}
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Passwort (mind. 8 Zeichen)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            secureTextEntry
            autoComplete={mode === "login" ? "password" : "new-password"}
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          {error || auth.authError ? (
            <Text testID="login-error" style={styles.error}>
              {error ?? auth.authError}
            </Text>
          ) : null}

          <Pressable testID="login-submit-button" onPress={submit} disabled={busy} style={[styles.submit, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.submitText}>{mode === "login" ? "ANMELDEN" : "REGISTRIEREN"}</Text>
            )}
          </Pressable>

          <Pressable
            testID="login-toggle-mode"
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {mode === "login" ? "Noch kein Konto? Jetzt registrieren" : "Schon ein Konto? Anmelden"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  headerRow: { flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 3, color: c.muted, paddingHorizontal: spacing.lg },
  title: { fontFamily: fonts.displayBold, fontSize: 40, color: c.onSurface, paddingHorizontal: spacing.lg },
  subtitle: { fontFamily: fonts.textRegular, fontSize: 14, color: c.onSurfaceTertiary, paddingHorizontal: spacing.lg },
  form: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  googleBtn: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  googleText: { fontFamily: fonts.textBold, fontSize: 15, color: "#1F1F1F" },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.xs },
  orLine: { flex: 1, height: 1, backgroundColor: c.border },
  orText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, color: c.muted },
  input: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: spacing.md,
    color: c.onSurface,
    fontFamily: fonts.text,
    fontSize: 15,
  },
  error: { fontFamily: fonts.text, fontSize: 13, color: c.error },
  submit: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 2, color: c.onBrandPrimary },
  toggle: { alignItems: "center", paddingVertical: spacing.sm },
  toggleText: { fontFamily: fonts.text, fontSize: 13, color: c.brandPrimary },
}));
