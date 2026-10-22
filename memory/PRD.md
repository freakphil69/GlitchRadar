# GlitchRadar – PRD

## Original Problem Statement
"Ich möchte dass du mir eine app baust die glitches im Internet findet super schnell bevor sie wieder nicht mehr funktionieren um natürlich schnell an Geld zu bekommen"

## User Choices
- Price errors + coupon glitches combined (plus cashback, shipping, stackable)
- AI scout only (no community)
- Dark radar/trading-terminal design, German UI
- Models: GPT 5.6 Terra (scout), Gemini 3 Flash (risk scoring), Claude Sonnet 5.5 (step plans), via the Emergent universal key
- User wants the 6-month plan (affiliate → PRO subscription → ads/sponsored)

## Architecture
- Backend: FastAPI + MongoDB (`/app/backend/server.py`), PyObjectId/BaseDocument models, tz-aware datetimes, scan lock (409 on parallel scans)
- Endpoints: GET /api/glitches, GET /api/glitches/{id}, POST /api/glitches/{id}/enrich, POST /api/glitches/{id}/report-dead, POST /api/scan, GET /api/scans/recent, GET /api/stats
- Affiliate: SHOP_LINKS mapping + Awin deeplink once AWIN_PUBLISHER_ID is set in .env
- Frontend: Expo Router, tabs RADAR/SCOUT/STASH/TERMINAL (NativeTabs on iOS 26+), modal /glitch/[id]; stash + settings stored locally

## Implemented (2026-10-19)
- Radar feed with countdowns, filter/sort chips, ticker
- AI scout scan with radar animation + terminal log; auto-scan on app start
- Detail screen: AI step plan, risk, copy code, shop/affiliate link (falls back to web search)
- Stash: watch/claimed ledger, savings counter, share button ("X € gespart")
- Terminal: auto-scan, interval, minimum discount, model info, disclaimer
- Logo/app icon (radar + glitch blip), adaptive icon, splash, favicon (`scripts/render_logo.py`)
- Marketing playbook: /app/memory/MARKETING_PLAYBOOK.md
- Tests: iteration_1 all passed (backend 14/14)

## Known Limits
- AI finds are simulations (often fictional shops) → no real live price errors yet
- Affiliate only earns money with a real Awin ID + real shops

## Backlog
- P0: real data sources (price feeds/deal RSS such as mydealz feed) instead of simulated finds
- P0: Awin publisher ID + affiliate disclosure ("Anzeige")
- P1: PRO subscription (4.99 €/month) via Stripe/RevenueCat
- P1: promo code vault tab
- P2: imprint/privacy screens, referral, hall of fame, sponsored signals
