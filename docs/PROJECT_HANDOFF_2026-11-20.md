# GlitchRadar: Projektübergabe und verbindlicher Zielumfang
Stand: 20.11.2026. Zusammenfassung der Nutzerentscheidungen aus dem Chat, keine Behauptung fertig implementierter Funktionen.
Einstieg für Grok und andere Entwickler: zuerst diese Datei lesen, danach aktuellen Code und Tests prüfen.

## Projekt und Arbeitsweise
Weiterentwicklung ausschließlich im Expo-Projekt freakphil69/GlitchRadar, App-Verzeichnis frontend, Backend backend. Nicht das separate Rork-Repository rork-scam-erkennung-per-screenshot mit seiner Kotlin-App bearbeiten oder als Ersatz verwenden. Keine Migration zu Kotlin gewünscht. Bestehende App-Identität, Optik, Funktionen und Animationen erhalten. Ziel ist ein vollständiger, zusammenhängender Android-Teststand und anschließend eine geprüfte Veröffentlichung, nicht endlose isolierte Detailarbeit. Keine Hintergrundarbeit oder bestandenen Tests behaupten, die tatsächlich nicht stattgefunden haben.

## Kern: Preisfehler
Preisfehler sind die Hauptintention und bleiben der Hauptbereich von GlitchRadar. Normale Deals, Coupons, Lieferdienste und Secondhand ergänzen ihn, verdrängen ihn nicht. Dezimal-/Kommafehler und kurzzeitige Auffälligkeiten finden; keine Fantasiepreise, Codes oder Lieferzusagen. Verdacht, aktueller Preischeck, Bestellung und bestätigte Auslieferung getrennt darstellen. Fundquelle, Fundzeit, Prüfzeit, Bedingungen und belegten Ablauf zeigen. Keine erfundenen Erfolgsprozente oder Garantie auf rechtliche Durchsetzbarkeit. Nutzerberichte zu Auslieferungen erst mit Fallzahl und Zeitraum als Statistik darstellen. Rechtliche Hinweise vor Veröffentlichung sachkundig prüfen lassen; ein Vertrag kann bei relevantem Irrtum anfechtbar sein. Nicht pauschal behaupten, verspätetes Bemerken sichere die Lieferung.

## Radar, Gestaltung und Bestandsschutz
Ursprüngliche Radar-Animation aus der Emergent-App unbedingt behalten. Bestehenden Splash/Intro-, Maskottchen-, Sonar-/Glitch- und Radar-Code zunächst untersuchen, nicht durch eine neue Listen-App ersetzen. Wünsche aus früheren Gesprächen: viele kleine Angebotspunkte; kurze Intro-Sequenz und fließender Übergang zum Maskottchen. Aktuelle Assets/Branding-Dokumentation im Repository sind vor Änderungen zu prüfen. Bereits vorhandene Suche, Filter, Favoriten/Stash, Detailansichten, Codes und vorhandene Warenkorb-Animation erhalten. Warenkorb-Animation bedeutet ausdrücklich KEINEN Essensbestellprozess. Ortsbezogener Lieferradar ist erwünscht; keine zufälligen Punkte als echte Anbieterpositionen ausgeben.

## Stadtwahl und Standort
Nutzer kann jede Stadt/PLZ unabhängig vom Aufenthaltsort wählen, z.B. aus Berlin Angebote in München suchen. Modi: Mein Standort, frei gewählte Stadt/PLZ, überregional/online. Manuelle Auswahl bleibt aktiv und wird nicht ungefragt von GPS überschrieben. Standort nur freiwillig und zweckgebunden, keine dauernde Hintergrundortung; manuelle Eingabe bei Ablehnung/Fehler weiterhin nutzbar. Für räumliche Angebote Umkreis und Distanz berücksichtigen, keine präzise Standortdarstellung ohne echte Koordinaten. Unbekannte Gültigkeit explizit markieren. Quelltextsuche nach einem Ortsnamen ist KEINE bestätigte Gebietsprüfung. Wohnort, Suchort und Lieferadresse sind unterschiedliche Dinge.

## Lieferdienste und lokale Coupons
Nur relevante Anbieter und Vergünstigungen für den gewählten Suchort anzeigen: Codes, Prozent-/Euro-Rabatte, kostenlose Lieferung, Aktionen. Mindestbestellwert, zeitliche Gültigkeit, teilnehmende Filialen, Neukunden-/persönliche Bedingungen und Ortsbeschränkung angeben, soweit belegt. Kein Bestellen, keine Speisekartenbestellung, keine Essenszahlung oder Checkout über GlitchRadar. Originalquelle oder offizielle Anbieter-App zum Einlösen öffnen. Nähe eines Restaurants beweist keine Lieferung an eine Adresse. Fehlende lokale Evidenz nicht als bestätigt ausgeben. McDonald's und andere Fast-Food-Aktionen berücksichtigen, keine universelle Coupon-Gültigkeit behaupten.

## Märkte und Angebote
Gewünscht: Amazon, MediaMarkt, Saturn, Epic Games, Temu, AliExpress, Vinted, markt.de sowie weitere geeignete Anbieter und lokale Märkte. Vinted/AliExpress sind die wahrscheinlichen Auflösungen der gesprochenen Namen mit V bzw. Ali. Zusätzliche Kandidaten: Kleinanzeigen, Otto, Cyberport, Alternate, Galaxus, Alza, Reichelt, Pollin, Notebooksbilliger. Kandidat bedeutet NICHT angebundene Quelle. Für jede Integration zulässigen Datenzugang, Verlässlichkeit, echte Produktlinks, Region und Aktualität prüfen; keine Sperren umgehen. Externe Suchverlinkung als solche bezeichnen, nicht als eigenen geprüften Feed.
Temu: eigener Filter/Bereich mit bis zu zehn günstigsten geeigneten Artikeln im tatsächlich angebundenen Feed. Preise, Versand und Bedingungen transparent; keine Behauptung einer vollständigen Temu-Marktsuche.
Secondhand: bis zu zehn gute gefundene Angebote; Zustand, Größe, Versand, Lokalität und Vergleichbarkeit berücksichtigen, nicht nur den niedrigsten Preis. Nur bei ausreichenden Daten belastbar ranken.
Schuhe/Kleidung: auch limitierte Drops, Verkaufsstart, Größen und Verfügbarkeit. Limitiert ist nicht automatisch günstig.
Black Week/Black Friday und bald ablaufende Angebote sichtbar machen; ursprünglicher Terminwunsch war Test vor Black Friday 27.11.2026, KEINE zugesagte Lieferfrist. Termine nicht dauerhaft hartcodieren.

## Quellenentdeckung zusätzlich zur Angebotssuche
Regelmäßig neue günstige Shops/Marktplätze/lokale Anbieter als Kandidaten entdecken, nicht nur bekannte Feeds durchsuchen. Getrennte Schritte: entdecken, Herkunft/Seriosität/Datenzugang prüfen, bewusste Aufnahme, laufende Qualitätskontrolle. Kein Versprechen, das gesamte Internet vollständig zu durchsuchen. Kostenbegrenzung, Caching und Nachvollziehbarkeit beachten. Keine autonom laufende Recherche behaupten, solange sie nicht eingerichtet ist.

## Inhaltssperre: kein Tierkram
Letzte Nutzerentscheidung: ganz ohne Tierkram. Nicht auf exotische oder lebende Tiere beschränken: Tierverkauf, Vermittlung/Tierheimvermittlung, Zucht, Tieranzeigen und Tierzubehör-Angebote aus diesem Produktscope ausschließen. Keine Ausnahmen aus scherzhaften Aussagen ableiten. Gilt auch für Privatanbieter, neue Quellen, Feed, Suche, Rankings und Benachrichtigungen. Unsichere Tieranzeigen zurückhalten. Fehlklassifikation normaler Waren mit Tiernamen/Marken in Tests berücksichtigen.

## Tatsächlich verifizierter Stand im Chat
- Expo-Frontend mit app.json, eas.json, Expo Router und React Query vorhanden.
- Android-Paket glitchradar.app; EAS-Projekt-ID ee978e42-a28b-4f71-9c24-dd62e8933c6a.
- EAS preview: APK/internal; production: AAB, remote versioning/autoIncrement; submit: internal/draft.
- Backend enthält konfigurierte RSS-Quellen u.a. mydealz Preisfehler, Gutscheine, HOT, Lieferdienste/Fast Food, DealDoktor und weitere. Konfiguration ist kein Nachweis aktueller Erreichbarkeit oder korrekter Live-Daten.
- Vorhandener /api/glitches-Endpunkt unterstützt Suchtext, Typ einschließlich delivery, Händler, Kategorien und Sortierung; im geprüften Stand keine strukturierten Orts-/Liefergebietsfilter.
- Im geprüften Frontend fehlte expo-location als Abhängigkeit. Aktuellen Stand erneut kontrollieren.
- Wiederholte markets.tsx-/Navigationsvorschläge im Chat wurden NICHT erfolgreich gespeichert. Ein Schreibversuch wurde mangels gültiger Freigabe abgewiesen. Nicht davon ausgehen, dass sie implementiert sind.
- Ein eigenständiger Python-Ortsfilter wurde als Chat-ZIP erstellt und elf isolierte Tests liefen erfolgreich. Er ist nicht als API-/Frontend-Integration nachgewiesen; dieses Dokument fügt ihn nicht hinzu.
- Ein Release-Bausatz wurde im Chat als ZIP erzeugt. Das nun beigefügte release-kit.mjs ist eine kompakte Repo-Fassung der Prüf-/Buildhilfe, keine Behauptung einer bytegleichen Übernahme des ZIPs.
- Kein nachgewiesener neuer Expo-/Android-Build, kein Gerätetest, kein Store-Upload und keine Veröffentlichung aus dieser Sitzung. Keine App-Funktion durch reine Dokumentation als erledigt markieren.

## Nächste Umsetzungsschritte und Abnahme
1. Aktuellen Commit, CI, package.json/Lockdateien, API-URL, Splash/Radar und Teststatus aufnehmen.
2. Preisfehler-Hauptbereich und echte Quellen prüfen; Tierausschluss vor Aufnahme und Ausgabe implementieren und testen.
3. Händler-/Temu-Ansicht an vorhandene Komponenten anbinden, ohne bestehende Funktionen zu ersetzen; Live-Daten fehlen ggf. weiterhin.
4. Standortbibliothek SDK-kompatibel installieren, Lockdatei/Permissions pflegen, freiwillige Ortung und freie Suchortwahl mit Persistenz, Fehler-/Ablehnungsfall umsetzen.
5. Sourced Orts-/Gültigkeitsmetadaten von Import über Datenmodell/API bis UI durchreichen. Unbekannt/lokal/überregional/außerhalb unterscheiden; Lieferbarkeit nicht aus Distanz ableiten.
6. Rabatt-/Couponbedingungen und lokale Anbieter, Drops und Quellenentdeckung implementieren, sofern belastbare Datenzugänge vorliegen. Fehlende Zugänge offen dokumentieren.
7. TypeScript, Lint, Beta-/Backendtests, Android-JS-Export und echte Gerätetests ausführen. Fehler beheben; genaue Ergebnisse/Commit festhalten.
8. EAS preview APK testen, danach production AAB und Play Console interner Test; öffentliche Veröffentlichung erst nach separater bewusster Freigabe.
Abnahme: freier Stadtwechsel trotz GPS; verweigerte Ortung funktioniert manuell; keine erfundenen Lokaldaten/Preise/Codes; keine Tiere/Tierzubehör; kein Essenscheckout; Preisfehler bleiben prominent; ursprüngliche Animation und übrige Funktionen erhalten; keine Secrets im Bundle.

## EAS-Bausatz im Repo verwenden
Im frontend-Verzeichnis arbeiten. Bestehende app.json/eas.json und Signierung erhalten. Abhängigkeiten mit passendem Projekt-Paketmanager installieren und Lockdateikonflikte klären. EAS CLI bereitstellen und anmelden. EXPO_PUBLIC_BACKEND_URL sowohl lokal als auch in EAS preview/production auf den echten HTTPS-Ursprung OHNE /api setzen. Keine Secrets in EXPO_PUBLIC_-Variablen. Bestehenden Android-Uploadschlüssel verwenden und Versionscodes gegen Play Console prüfen.
Nur prüfen: node scripts/release-kit.mjs check
APK bauen (Bash): GLITCHRADAR_ALLOW_BUILD=YES node scripts/release-kit.mjs preview
AAB bauen (Bash): GLITCHRADAR_ALLOW_BUILD=YES node scripts/release-kit.mjs production
PowerShell: zuerst $env:GLITCHRADAR_ALLOW_BUILD='YES' setzen, dann node-Aufruf.
Diese Befehle werden durch das Speichern NICHT ausgeführt. Cloud-Build kann Kontingent/Geld kosten. Skript prüft Remote-Umgebung, Signing, Backend-Daten und Store-Felder nicht vollständig. AAB manuell in Play Console prüfen/hochladen oder nach gesonderter Freigabe EAS Submit nutzen. Kein automatischer Upload enthalten. Datenschutz/Impressum, Daten-Sicherheit, Inhaltsbewertung, App-Zugriff, Kontolöschung soweit relevant und Store-Eintrag vor Veröffentlichung klären.
Dokumentation: https://docs.expo.dev/build-reference/build-with-monorepos/ ; https://docs.expo.dev/build-reference/apk/ ; https://docs.expo.dev/submit/android/
