# GlitchRadar – PRD

## Original Problem Statement
"Ich möchte dass du mir eine app baust die glitches im Internet findet super schnell bevor sie wieder nicht mehr funktionieren um natürlich schnell an Geld zu bekommen"

## User Choices
- Price errors + coupon glitches (plus cashback, shipping, stackable, deals)
- Dark radar/trading-terminal design, German UI
- User requirement (latest): NO AI-generated finds; only real finds shown with where/when they were found online
- PRO subscription via RevenueCat (connected), promo code vault, legal pages
- Imprint: Philipp Köhler, Kleiner Diebsteig 25, 18439 Stralsund, philippkohler940@gmail.com

## Architecture
- Backend FastAPI + MongoDB: `server.py`, `feeds.py` (RSS: mydealz Preisfehler-Gruppe, Gutscheine, Hot; DealDoktor)
- Background poll every 10 min + manual POST /api/scan (lock → 409), dedupe by unique source_url, finds older than 72h expire
- AI only evaluates real finds: Gemini 3 Flash (risk/success rate), Claude Sonnet 5.5 (step plan, no invented facts)
- Endpoints: /api/glitches, /api/glitches/{id}, /enrich, /report-dead, /vote, /api/codes, /api/scan, /api/scans/recent, /api/stats, /api/img (web image proxy, whitelisted hosts)
- Frontend Expo Router: tabs RADAR / CODES / STASH / TERMINAL; stack: /scout, /pro (modal), /legal, /glitch/[id] (modal)
- RevenueCat: SDK init at module scope in _layout, SubscriptionProvider, entitlement "pro"; see /app/memory/revenuecat.md

## Implemented
- 2026-10-19: MVP (radar, scout, stash, terminal), affiliate links, share savings, logo/icons
- 2026-10-22: real RSS finds (AI simulations removed), source + age display, images, temperature, code vault with voting, PRO paywall (3 free manual scans/day), imprint/privacy/ad label, tests iteration_2 passed (22/22 backend)

## Known Limits
- Purchases blocked until login exists (RevenueCat requires a stable user ID)
- Real store purchases need App Store/Play products + credentials (RevenueCat FAQ in the payments panel)
- Affiliate commissions need AWIN_PUBLISHER_ID
- Deal content comes from third-party feeds → short excerpt + link to the original; clarify permission/partnership with mydealz before a large launch

## Backlog
- P0: login (JWT or Google) → enables PRO purchases
- P1: push alerts for new price errors (needs a build)
- P1: more sources (e.g. Preisjäger, retailer price feeds)
- P2: hall of fame, referral, sponsored signals
