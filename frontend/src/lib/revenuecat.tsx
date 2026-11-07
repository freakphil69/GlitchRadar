import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const TRIAL_KEY = "glitchradar.proTrialEndsAt";
export const TRIAL_DAYS = 3;

async function loadOrStartTrial(): Promise<number> {
  const raw = await AsyncStorage.getItem(TRIAL_KEY);
  if (raw) return Number(raw);
  const ends = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  await AsyncStorage.setItem(TRIAL_KEY, String(ends));
  return ends;
}

export function trialLeftText(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `noch ${d} T ${h} Std` : `noch ${h} Std ${Math.floor((ms % 3_600_000) / 60_000)} Min`;
}

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro"; // from setup: entitlement_lookup_key

export const rcEnabled = Platform.OS !== "web" || __DEV__; // web preview uses the Test Store
export const isTestStore = Platform.OS === "web" || __DEV__;

function getRevenueCatApiKey(): string {
  // Pick the platform/mode first, then validate ONLY the key that is actually needed.
  let key: string | undefined;
  let name: string;
  if (Platform.OS === "web" || __DEV__) {
    key = REVENUECAT_TEST_API_KEY; // Expo Go and the web preview use the RevenueCat Test Store
    name = "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY";
  } else if (Platform.OS === "android") {
    key = REVENUECAT_ANDROID_API_KEY;
    name = "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY";
  } else if (Platform.OS === "ios") {
    key = REVENUECAT_IOS_API_KEY;
    name = "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY";
  } else {
    key = REVENUECAT_TEST_API_KEY;
    name = "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY";
  }
  if (!key) throw new Error(`RevenueCat key missing: ${name}`);
  return key;
}

// True only after Purchases.configure() succeeded. All SDK queries depend on this.
let rcConfigured = false;
export function isRevenueCatConfigured() {
  return rcConfigured;
}

export function initializeRevenueCat() {
  if (!rcEnabled) return; // no store on production web
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: getRevenueCatApiKey() });
  rcConfigured = true;
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const rcReady = rcEnabled && rcConfigured;

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: rcReady,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => Purchases.getOfferings(),
    enabled: rcReady,
    staleTime: 300 * 1000,
  });

  // Reactive entitlement updates — the SDK pushes fresh CustomerInfo after
  // purchases, restores, renewals, and logIn/logOut. Never poll for this.
  useEffect(() => {
    if (!rcReady) return;
    const listener = (info: CustomerInfo) => queryClient.setQueryData(["revenuecat", "customer-info"], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient, rcReady]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      if (!rcReady) throw new Error("store_unavailable");
      // Choke point: never let an anonymous purchase through (see identity rule).
      // originalAppUserId stays the first anonymous id after an alias merge, so check the current id.
      if (await Purchases.isAnonymous()) throw new Error("identity_not_ready");
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!rcReady) throw new Error("store_unavailable");
      return Purchases.restorePurchases();
    },
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // 3-day free PRO trial for new users, started on first app launch (stored on this device).
  const trialQuery = useQuery({ queryKey: ["pro-trial"], queryFn: loadOrStartTrial, staleTime: Infinity });
  const trialEndsAt = trialQuery.data ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const trialActive = !isSubscribed && trialEndsAt != null && trialEndsAt > now;
  const isPro = isSubscribed || trialActive;

  // Current RevenueCat user id, refreshed whenever customer info changes (logIn/logOut push new info).
  const [appUserId, setAppUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!rcReady || !customerInfoQuery.data) return;
    Purchases.getAppUserID()
      .then(setAppUserId)
      .catch(() => setAppUserId(null));
  }, [customerInfoQuery.data, customerInfoQuery.dataUpdatedAt]);
  const identityReady = !!appUserId && !appUserId.startsWith("$RCAnonymousID:");

  return {
    storeReady: rcReady,
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    offeringsError: offeringsQuery.error,
    isSubscribed,
    isPro,
    trialActive,
    trialEndsAt,
    identityReady,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
