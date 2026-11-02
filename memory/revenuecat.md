# RevenueCat — integrated (2026-10-22)
This file is a memory for interacting with the user's RevenueCat account via the integration proxy later.

## Identifiers (from /setup response)
- rc_project_id: proj836830ba
- apple_app_id: app95c2f8adab
- play_app_id: appff6c4a49cb
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_weekly  -> prod4b66723662   (2.99 EUR, P1W, trial: none)  [added 2026-11-01]
  - $rc_monthly -> prodf2cab5a906   (7.99 EUR, P1M, trial: none)  [re-created 2026-11-01 after stale-id error]
  - $rc_annual  -> prod76b960b14a   (49.99 EUR, P1Y, trial: none) [re-created 2026-11-01 after stale-id error]
- Lifetime 69.99 EUR wanted by user: NOT possible via proxy (period required). Paywall renders any extra package
  (e.g. LIFETIME added in RevenueCat dashboard to offering 'default' + entitlement 'pro') automatically.
- Intro offer wanted by user: 25% off (7.49 €) for the first 3 months — NOT settable via proxy (only "trial");
  user must create it as introductory offer in App Store Connect / Play Console. Paywall shows product.introPrice automatically.
- Dashboard: https://app.revenuecat.com/projects/proj836830ba

## Status check (use the Bearer emergent key header, never store it here)
GET $INTEGRATION_PROXY_URL/internal/revenuecat/projects/8dc4d88d-d3c1-4e40-9f62-93a6983f390d/status
If project_state is below project_created, re-fetch the RevenueCat playbook via integration expert.

## Later updates (integration proxy ONLY — never the RevenueCat REST API)
- Upsert price/period/trial or add package:
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/8dc4d88d-d3c1-4e40-9f62-93a6983f390d/products
  body: {"products":[{"package":"$rc_monthly","price":4.99,"currency":"EUR","period":"P1M","prices":[{"amount_micros":4990000,"currency":"EUR"}]}]}
- Remove package: DELETE .../products/%24rc_monthly
- Recover identifiers / repopulate .env: re-run idempotent /setup with bundle_id/package_name com.emergent.errorscout.kircz0

## Taking purchases LIVE — user steps
1. Upload App Store Connect API key (.p8) + In-app purchase key, and Google Play service-account JSON in the RevenueCat dashboard.
2. Set up payment profiles in App Store Connect and Play Console.
3. Create matching subscription products with the SAME product IDs as in the RevenueCat dashboard.
4. Release build → TestFlight / Play internal testing → store review.
All steps are also listed in the FAQ section of the payments panel.

## Identity
Auth exists (2026-10-23): AuthProvider (src/lib/auth.tsx) calls Purchases.logIn(user.user_id) on restore/login/register and Purchases.logOut() on logout.

- 2026-11-01: After DELETE+re-upsert of $rc_monthly/$rc_annual and re-running /setup, the Test Store offering still returns ONLY $rc_weekly (prices show in USD). Escalated to user; check offering "default" in dashboard.

- 2026-11-02: User asked for RevenueCatUI; decided to KEEP custom orange paywall (pro.tsx). Offering now shows weekly+monthly; annual+lifetime still missing in offering "default". react-native-purchases-ui NOT installed (not needed).

- 2026-11-02: Lifetime removed per user. $rc_annual re-created again -> prodbe18c12f67 (previous ids missing, user likely deleted in dashboard). App trial is device-side, NOT a store trial.

- identityReady now uses Purchases.getAppUserID()/isAnonymous() (originalAppUserId stays anonymous after alias merge)
