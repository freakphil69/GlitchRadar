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
- 2026-10-23: login (email/password JWT + Emergent Google, optional), RevenueCat logIn/logOut, stash account sync, Hall of Fame (+ banner, share), new sources (mydealz Gratis, Preisjäger Preisfehler/Hot, myTopDeals, Sparhamster), affiliate only with real IDs (AWIN_PUBLISHER_ID, AWIN_ADVERTISER_IDS "shop=id,…", AMAZON_PARTNER_TAG), PRO 9.99 €/79.99 €, tests iteration_3 passed (37/37 backend)

## Known Limits
- 25% intro offer for 3 months must be created in App Store Connect / Play Console
- Real store purchases need App Store/Play products + credentials (RevenueCat FAQ in the payments panel)
- Affiliate commissions only after the user's partner IDs are entered
- Deal content comes from third-party feeds → short excerpt + link to the original; clarify permission/partnership with the feed operators before a large launch

## Backlog
- P1: push alerts for new price errors (needs a build)
- P1: account deletion in the app (currently by email)
- P2: referral, sponsored signals, personal alerts per shop/keyword

## Iteration 4 (Juni 2026)
- Google-Login (Emergent) verifiziert: Button + Redirect + /api/auth/session (401 bei ungültiger ID)
- Terminal: PRO/Free-Plan-Banner (testID terminal-plan-banner) mit Konto-Bindung + RevenueCat-Identity-Fehler
- Quellen-Texte um Preisjäger ergänzt
- Offen: AWIN_ID (Platzhalter), optional Push-Alerts

## Iteration 5 (Juni 2026)
- Glitch-Alarm (GET /api/alarm, GlitchAlarm-Banner im Radar)
- Lieblings-Shops & Kategorien (GET /api/facets, /favorites, Filter shops/categories in /api/glitches)
- Ersparnis-Statistik im Terminal (aus gesicherten Stash-Einträgen)
- Awin: AWIN_PUBLISHER_ID + AWIN_ADVERTISER_IDS ("zalando=1234,otto=5678") per Secrets angefragt

## Iteration 6 (Juni 2026)
- Story-Grafik teilen (/share-savings, react-native-view-shot + expo-sharing)
- Produktsuche im Radar (q-Parameter in /api/glitches, Mehrwort-Suche, ignoriert Favoriten-Filter, mydealz-Fallback)

## Iteration 7 (Juni 2026)
- Neue Paywall (pro.tsx) nach User-Vorlage in App-Orange: Woche/Jahr(empfohlen)/Monat Karten, Lifetime-Karte automatisch falls Paket existiert
- RevenueCat: weekly 2,99 / monthly 7,99 / annual 49,99 EUR upserted; Offering zeigt aktuell nur weekly (Provisioning-Problem, offen)

- Lieferdienst-Feeds (mydealz lieferservice + fast-food) ergänzt; „Echtheit prüfen“-Box auf Detailseite (Original-Beitrag + Community-Grad)

## Iteration 8
- Schnellfilter LIEFERDIENSTE (type=delivery, Regex auf Shop/Titel/Quelle)
- Letzte & beliebte Suchen unter dem Suchfeld (AsyncStorage, max 8)

- In-App Splash (AppSplash.tsx): Logo + Radar-Puls 1,8 s, dann Fade; native Splash bleibt via expo-splash-screen

- Neues Logo (cyan→violett) als icon/adaptive-icon/favicon/splash-image + logo-full.png im In-App-Splash; Splash-Hintergrund #000000

- Logo auf App-Orange umgefärbt (amber→#FF5722), alle Icons/Splash neu generiert aus /tmp/logo.jpg

- Logo v3: Glitch-Kreis (minimal_set2_glitch.png) orange umgefärbt + GLITCHRADAR-Schriftzug, in icon/adaptive/favicon/splash/logo-full
