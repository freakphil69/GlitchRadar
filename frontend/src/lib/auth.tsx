import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Purchases from "react-native-purchases";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, apiGet, apiPost, setAuthToken, setUnauthorizedHandler } from "./api";
import { rcEnabled } from "./revenuecat";
import { syncStash } from "./stash";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "gr_auth_token";
const SESSION_RE = /[?#&]session_id=([^&#]+)/;

export interface User {
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  auth_provider: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

function useAuthState() {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const sentIds = useRef(new Set<string>());
  const rcIdentity = useRef<string | null>(null);

  const applySession = useCallback(async (res: AuthResponse) => {
    await storage.secureSet(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setUser(res.user);
    setAuthError(null);
  }, []);

  const clearSession = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  // Exchanges a one-time Google session_id (from the redirect URL) exactly once.
  const exchange = useCallback(
    async (url: string): Promise<boolean> => {
      const m = url.match(SESSION_RE);
      if (!m) return false;
      const sid = decodeURIComponent(m[1]);
      if (sentIds.current.has(sid)) return true;
      sentIds.current.add(sid);
      const res = await apiPost<AuthResponse>("/auth/session", { session_id: sid });
      await applySession(res);
      return true;
    },
    [applySession],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Mount: process a pending session_id first, otherwise restore the stored token.
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const href = window.location.href;
          if (SESSION_RE.test(href)) {
            try {
              await exchange(href);
              const u = new URL(href);
              u.searchParams.delete("session_id");
              u.hash = u.hash
                .replace(/^#/, "")
                .split("&")
                .filter((p) => p && !p.startsWith("session_id="))
                .join("&");
              window.history.replaceState(window.history.state, "", u.toString());
              return;
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial && SESSION_RE.test(initial)) {
            try {
              await exchange(initial);
              return;
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }
        }
        const token = await storage.secureGet<string>(TOKEN_KEY, "");
        if (token) {
          setAuthToken(token);
          try {
            setUser(await apiGet<User>("/auth/me"));
          } catch (error) {
            // A temporary outage is not an expired session. Keep the saved token
            // so the next successful request/restart can restore the account.
            if (error instanceof ApiError && error.status === 401) {
              await clearSession();
            } else {
              setAuthError((error as Error).message);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [exchange, clearSession]);

  // Hot deep links (native): a second source for the Google redirect.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (SESSION_RE.test(url)) exchange(url).catch((e) => setAuthError((e as Error).message));
    });
    return () => sub.remove();
  }, [exchange]);

  // RevenueCat identity: bind purchases to the stable user_id on every auth path.
  useEffect(() => {
    if (!rcEnabled) return;
    (async () => {
      try {
        if (user?.user_id && rcIdentity.current !== user.user_id) {
          await Purchases.logIn(user.user_id);
          rcIdentity.current = user.user_id;
          setIdentityError(null);
          qc.invalidateQueries({ queryKey: ["revenuecat"] });
        } else if (!user && rcIdentity.current) {
          await Purchases.logOut();
          rcIdentity.current = null;
          qc.invalidateQueries({ queryKey: ["revenuecat"] });
        }
      } catch (e) {
        setIdentityError(String((e as Error).message ?? e));
      }
    })();
  }, [user, qc]);

  // Stash sync after login.
  useEffect(() => {
    if (!user) return;
    syncStash()
      .then(() => qc.invalidateQueries({ queryKey: ["stash"] }))
      .catch(() => {});
  }, [user, qc]);

  const loginEmail = async (email: string, password: string) => {
    await applySession(await apiPost<AuthResponse>("/auth/login", { email, password }));
  };

  const register = async (email: string, password: string, name?: string) => {
    await applySession(await apiPost<AuthResponse>("/auth/register", { email, password, name }));
  };

  const loginGoogle = async (): Promise<boolean> => {
    const redirectUrl = Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return false;
    }
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const url =
        (result.type === "success" ? result.url : null) ?? captured ?? (await Linking.getInitialURL());
      if (url && SESSION_RE.test(url)) return await exchange(url);
      return false;
    } finally {
      sub.remove();
    }
  };

  const logout = async () => {
    try {
      await apiPost("/auth/logout", {});
    } catch {
      // local cleanup still happens
    }
    await clearSession();
  };

  return { user, loading, authError, identityError, loginEmail, register, loginGoogle, logout };
}

type AuthValue = ReturnType<typeof useAuthState>;
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
