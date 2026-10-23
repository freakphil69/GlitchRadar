# RevenueCat — integrated (2026-10-22)
This file is a memory for interacting with the user's RevenueCat account via the integration proxy later.

## Identifiers (from /setup response)
- rc_project_id: proj836830ba
- apple_app_id: app95c2f8adab
- play_app_id: appff6c4a49cb
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prodd2ef7c0371   (9.99 EUR / 9.99 USD, P1M, trial: none)
  - $rc_annual  -> prodd76ebf060f   (79.99 EUR / 79.99 USD, P1Y, trial: none)
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
