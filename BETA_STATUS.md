# GlitchRadar: Beta-Prüfstand

## Reparaturlauf vom 12. November 2026

Die Kauf-Link-Prüfung wurde mit neuen deterministischen Gegenproben weiter
abgesichert. Der ursprüngliche Lauf von
`backend/tests/test_purchase_evidence_regressions.py` hatte 22 Fehlschläge bei
14 bestandenen Fällen: Script-/Style-/Noscript-Inhalte konnten Kauftexte
vortäuschen oder echte Kauftexte negieren; Wahrheitswerte und negative Preise
konnten außerdem als Preisnachweis durchgehen. Gespeicherte Nachweise
akzeptierten zusätzlich ungültige Preistypen und unendliche Werte.

`link_checks.py` ignoriert jetzt nicht sichtbare Script-/Style-/Noscript-Inhalte
bei der Erkennung einer Kaufaktion, liest JSON-LD aber weiterhin aus. Erwartete
und gespeicherte Preise müssen endliche, nicht negative Zahlen sein;
Wahrheitswerte sind ausdrücklich ausgeschlossen. Händlerpreise dürfen weiterhin
übliche numerische JSON-Zeichenketten sein, werden aber ebenfalls auf endliche,
nicht negative Werte geprüft. Kostenlose Angebote mit Preis null bleiben erlaubt.

Nach der Korrektur bestehen lokal:

- 195 Offline-Backend-Tests für Kernablauf, Kostenbremse, Feeds und Kaufnachweise.
  Darin sind die 36 neuen Gegenproben und zwei Detail-API-Tests enthalten, die
  ein gespeichertes Angebot erneut laden und falsche Wahrheitswert-Preisnachweise
  zurückweisen.
- Weitere fünf HTML-Bereinigungstests, getrennt von neun nicht erneut
  ausgeführten Live-Tests.
- Alle 33 Frontend-Tests und `npx tsc --noEmit`.
- `git diff --check`.

Der dedizierte GitHub-Linkcheck wurde um die neuen Gegenproben und die schon
vorhandenen HTTP-/Weiterleitungsprüfungen erweitert. Der zugehörige
[GitHub-Actions-Lauf](https://github.com/freakphil69/GlitchRadar/actions/runs/43315645685)
für Commit `d58c6a6` wurde anschließend mit Status `success` abgeschlossen.
Die übrigen oben genannten Ergebnisse sind lokale Prüfungen, kein vollständiger
grüner CI-Lauf aller Backend-/Live-Tests.

Die neun alten Live-HTML-Prüfungen lieferten beim ersten Diagnoseversuch HTTP 404
aus der Vorschau und sind damit nicht bestanden. Der frühere fehlgeschlagene
vollständige GitHub-Testlauf ist hiermit ebenfalls nicht repariert oder
nachträglich freigegeben; seine Job-Logs waren über die verfügbare API nicht
abrufbar. Es gab kein Live-Deployment, keine neue reale Angebotsstichprobe und
keinen signierten Android-/Store-Kauftest.

## Historischer Prüfstand vom 9. November 2026

Stand: 9. November 2026. Ziel ist ein zuverlässiger Start und der Kernablauf „Funde laden, suchen, öffnen und zur richtigen Quelle gelangen“. Die Beta-Korrekturen wurden mit dem Hauptzweig zusammengeführt und gemeinsam lokal geprüft. Eine anschließende Prüfung von 40 echten Angeboten ist dokumentiert, aber die Beta bleibt wegen Angebotsfehlern, unvollständiger Kaufabnahme und eines kritischen Speicherbefunds gesperrt.

## Aktueller Ressourcen- und Live-Befund

Nach der zwischenzeitlichen 404-Phase ist die Vorschau bei einem erneuten ungecachten Abruf am 9. November wieder erreichbar. Auch die Emergent-Codeansicht wurde wieder verfügbar; die separate Web-IDE verlangt jedoch eine Anmeldung mit dem Projektpasswort. Der aktuelle Vorschau-Code enthält zusätzliche Dateien wie `jev.py`, die nicht im zusammengeführten GitHub-Stand enthalten sind. Vor einer Übernahme müssen diese Unterschiede erhalten und abgeglichen werden; ein blindes Überschreiben ist keine zulässige Abkürzung. ([Vorschau-API](https://error-scout-20.preview.emergentagent.com/api/glitches), [Emergent-Codeansicht](https://app.emergent.sh/chat))

## Korrekturen nach der echten Stichprobe

Im lokalen Quellcode sind inzwischen die zentrale Kauf-Link-Sperre, getrennte Affiliate-Nachweise, begrenzte Nachprüfungen und die erneute API-Prüfung vor dem Öffnen umgesetzt. Fehlende oder veraltete Nachweise geben nur einen ungeprüften Originalbeitrag frei; eine geprüfte Verkaufsseite ist ausdrücklich keine Kauf- oder Liefergarantie. Die Einzelregeln und Grenzen stehen in `LINK_CHECK_POLICY.md`.

Zusätzlich wurden Tausenderpreise, kurze Codes, falsch als kombinierbar gelesene Negationen, alte widersprüchliche Preisanzeigen und automatisch beim Öffnen gestartete KI-Analysen korrigiert. Feed- und Bildpuffer sowie die parallelen Downloads sind begrenzt. Eine Wirkung auf den Speicherverbrauch des veröffentlichten Servers wurde noch nicht gemessen.

Die Änderungen sind noch nicht im aktuellen Testraum verifiziert. Die bestehenden 40 realen Angebotsprüfungen werden nicht durch neue Offline-Fixtures oder Unit-Tests zu bestandenen Kaufprüfungen erklärt.

Der abschließende lokale Lauf nach diesen Änderungen besteht 43 Backend-Tests für Kernablauf, KI-Kostenbremse, Feed-Regressionen und Linkfreigabe sowie fünf HTML-Bereinigungstests. Alle 33 Frontend-Tests, TypeScript, gezieltes Linting der geänderten Oberflächen und der Android-JavaScript-/Asset-Export bestehen. Versteckte Kaufaktionen, verneinte Kauftexte und mehrdeutige Produktlisten wurden zunächst als fehlschlagende Gegenproben reproduziert und anschließend abgesichert. Auch dieser Export ist kein signiertes AAB und kein Android-Geräte-/Store-Test.

Das Monitoring des veröffentlichten Emergent-Projekts „glitchradar“ zeigte CPU **24 %**, Peak **30 %**, aber Arbeitsspeicher **100 %**, Peak **100 %**, als „Critical“ markiert. Die Anzeige liefert damit einen konkreten Speicherbefund statt eines Nachweises für eine aktuell hohe CPU-Last; Antwortzeit und Fehlerrate zeigten keine Zahlen. Eine Behebung oder eine grüne Laufzeit ist nicht bestätigt. ([Emergent-Monitoring](https://app.emergent.sh/chat))

Beim früheren Diagnoseversuch funktionierte die Anmeldung zu Emergent, die Codeansicht blieb aber zunächst im Schlaf-/„Resuming…“-Zustand ohne zugängliche Prozessdiagnose. Sie ist wie oben beschrieben inzwischen wieder verfügbar. Es wurde keine Laufzeitkonfiguration geändert und kein Upgrade, Credit-Kauf oder zusätzlicher KI-Buildauftrag ausgelöst; eine bloße Reduzierung von CPU oder Polling wird nicht als nachgewiesene Lösung des Speicherproblems ausgegeben. ([Emergent-Projekt](https://app.emergent.sh/chat))

Während der echten Angebotsprüfung waren zunächst 19 Detailantworten korrekt abrufbar. Danach schlugen die weiteren 21 Detailprüfungen fehl; bei direkten Kontrollabrufen lieferten sowohl die gesamte Angebotsliste als auch ein zuvor funktionierendes Detail HTTP 404. Die Ursache dieses Vorschau-Ausfalls ist nicht nachgewiesen und wird nicht pauschal dem Speicher oder fehlenden Credits zugeschrieben. ([Angebotsliste](https://error-scout-20.preview.emergentagent.com/api/glitches), [zuvor lesbares Detail](https://error-scout-20.preview.emergentagent.com/api/glitches/6af1a08feea38b93775b2783))

## Zusammenführung mit main

Ausgangspunkt waren `main` bei `969466f` und `beta-core` bei `5b785e0`. Die Zusammenführung ist als Commit `d303075329147dee13ce954e0598f11e90281cbf` auf `main` abgeschlossen. Sie integriert Sparbetrieb, präzise Angebotsziele, Timeout-Absicherung und Maskottchen mit den neueren Hauptzweig-Änderungen an RevenueCat, `eas.json` und dem Paketnamen `glitchradar.app`; kein Zweig wurde erzwungen überschrieben. ([Merge-Commit](https://github.com/freakphil69/GlitchRadar/commit/d303075329147dee13ce954e0598f11e90281cbf), [PR #1](https://github.com/freakphil69/GlitchRadar/pull/1))

Der einzige Textkonflikt lag in `frontend/src/lib/revenuecat.tsx`. Die gemeinsame Lösung erhält beide Absichten: Nur der Schlüssel der jeweiligen Plattform wird benötigt; fehlende Store-Konfiguration blockiert den kostenlosen App-Kern nicht. Nach erfolgreicher SDK-Konfiguration werden beide Bereitschaftsmerkmale gesetzt. SDK-Abfragen, Listener, Kauf und Wiederherstellung bleiben bis dahin gesperrt. Die neuere Prüfung auf den tatsächlichen PRO-Anspruch nach Kauf/Wiederherstellung und die klare Jahrespreis-Beschriftung bleiben erhalten.

Zusätzliche Tests prüfen diese zusammengeführten SDK-Sperren, die Kauf-/Wiederherstellungsmeldungen sowie Paketname und den internen Entwurfs-Testkanal. Die Kaufprüfungen verwenden ausschließlich SDK-Stubs; es wurde kein echter Kauf ausgeführt. Der Budget-Test verwendet jetzt einen vom Testpfad abgeleiteten Import statt des fremden absoluten Pfads `/tmp/gr/backend`.

Ergebnis der ursprünglichen Zusammenführung am 9. November; die neueren Korrekturen und Testzahlen stehen oben:

- **Frontend:** 23 von 23 Tests bestanden.
- **Backend-Kern und KI-Kostenbremse:** 11 von 11 Offline-Tests bestanden.
- **HTML-Bereinigung:** Weitere fünf lokale `_to_text`-Tests bestanden; die neun Live-Tests dieser Datei wurden nicht ausgeführt.
- **TypeScript:** `npx tsc --noEmit` bestanden.
- **Gezieltes Lint:** API, Auth, Billing, Fokus-Anbindung, Preisvergleich, Maskottchen, Startbildschirm, Ticker, Paywall, Teilen-Karte und Root-Layout ohne Befund.
- **Android:** JavaScript-/Asset-Export erfolgreich. Kein signiertes AAB, keine Installation und keine Store-Kaufprüfung.
- **Warnungen:** Der Backend-Lauf enthält Deprecation-Hinweise von FastAPI/Python und pytest-asyncio. Sie wurden nicht als Produktfehler oder verschwunden ausgegeben.

## Ergebnis bisher

- **Grundlage:** Der gemeinsame Stand integriert `beta-core` einschließlich der bisherigen Änderungen aus `sparbetrieb`, Kostenbremse, FAQ und Feedback mit `main`. Die laufende Emergent-App wird dadurch nicht automatisch aktualisiert.
- **Lokale Tests:** Nach den zusätzlichen Korrekturen besteht der Stand 33 Frontend- und 48 ausgewählte Backend-Tests einschließlich HTML-Bereinigung. TypeScript, gezieltes Lint und Android-Export bestehen ebenfalls.
- **Android-Bündel:** Die JavaScript-/Asset-Bündelung wurde nach Behebung des Versionskonflikts erfolgreich durchgeführt. Das ist kein signiertes AAB und kein Installationstest auf einem Android-Gerät.
- **Echte Angebotsstichprobe:** 40 unterschiedliche echte App-Angebote und ihre 40 Originalseiten wurden geprüft; keine Test-Fixtures. Es gibt sechs dokumentierte Fehlerfälle, weitere offene oder teilgeprüfte Fälle und keine vollständige Kauf-Freigabe. Der vollständige Einzelbericht heißt „GlitchRadar: 40 echte Angebotsprüfungen“.
- **Kosten:** Die neuen Tests verwenden eine simulierte Datenbank, Feed-Fixtures und SDK-Stubs. Sie benötigen keine kostenpflichtigen KI-Aufrufe.
- **Maskottchen als Logo:** Start, Hauptseiten-Ticker, Paywall-Kopf, Jahresangebot, PRO-Bestätigung und Teilen-Karte verwenden die Figur. Native Icon-Dateien angepasst. Endlose Intro-Bewegung durch einmaligen 350-ms-Glitch ersetzt, mit reduzierter Bewegung und Cleanup. Nativer Hintergrundstatus für Query-Abfragen angebunden. Grenzen stehen in `MASCOT_STATUS.md`; keine gemessene CPU-/Akkuersparnis und weiterhin kein Live-Deployment.

## Nachgewiesene und korrigierte Probleme

- **Falsches Angebotsziel:** Wenn ein konkreter Produktlink fehlte, wurde aus dem Händlernamen eine Händler-Startseite erzeugt. Eine solche Seite ist kein passendes Produktziel. Diese automatische Ersetzung entfällt, einschließlich daraus abgeleiteter Affiliate-Links.
- **Ehrliche Beschriftung:** Ohne konkreten Produktlink führt die Aktion ausdrücklich zum Original-Beitrag statt zu einer Händler-Startseite oder einer Google-Suche. Das bestätigt weder den Händlerpreis noch die aktuelle Verfügbarkeit.
- **Produktbezogene Affiliate-Links:** Amazon-Partnerparameter werden an das konkrete Produktziel angehängt, ohne Pfad und bestehende produktrelevante Parameter zu verlieren. Alte separate Affiliate-Ziele werden nicht ungeprüft übernommen.
- **Android-Buildblocker:** `expo-audio` zog über seine unbeschränkte Peer-Abhängigkeit `expo-asset` 58, während das Projekt Expo 57 verwendet. `expo-asset` ist jetzt passend zu den lokalen SDK-Metadaten auf `~57.0.20` begrenzt. Ein npm-Lockfile hält die aufgelösten Abhängigkeiten fest.
- **RevenueCat beim Start:** Ein Android-Release benötigt nicht zusätzlich iOS- und Test-Store-Schlüssel. Ohne passende Abrechnungskonfiguration bleibt der kostenlose Kernablauf verfügbar; SDK-Listener werden nicht vor erfolgreicher Konfiguration aktiviert.
- **API-Verbindungen:** Fehlende Backend-Konfiguration führt zu einer verständlichen Fehlermeldung statt Requests an `undefined/api`. Normale Requests haben ein Zeitlimit; Scan und Analyse erhalten ein längeres Zeitfenster.
- **Sitzungswiederherstellung:** Ein temporärer Netzwerk- oder Serverfehler löscht eine gespeicherte Anmeldung nicht mehr. HTTP 401 bleibt der Grund für die Abmeldung.
- **Optionale KI:** Das Backend kann ohne KI-Schlüssel und ohne installierte optionale LLM-Bibliothek importiert werden. Feed und Details bleiben unabhängig davon nutzbar. Eine nicht eingerichtete neue KI-Analyse liefert eine ausdrückliche Fehlermeldung.
- **Analyse erneut versuchen:** Die Schaltfläche startet tatsächlich einen neuen Versuch, statt nur den lokalen Mutation-Zustand zurückzusetzen.

## Geprüfte lokale Abläufe

Backend:

```sh
pytest -c /dev/null -q backend/tests/test_beta_core.py backend/tests/test_ai_budget.py
```

Die sechs neuen Kerntests prüfen Import ohne KI, Scan mit einem kontrollierten Feed, Suche, Detail, Duplikatvermeidung und Fehlerbehandlung bei nicht erreichbaren Quellen sowie die präzisen Linkziele. Dazu kommen fünf vorhandene Tests zur Kostenbremse.

Frontend:

```sh
cd frontend
npm run test:beta
npx tsc --noEmit
```

Die ursprünglichen sieben Frontend-Tests prüfen URL-Normalisierung, Auth-Header, fehlende Konfiguration, Timeout, HTTP-Statusbehandlung sowie drei RevenueCat-Startfälle. Die ergänzenden Tests prüfen Bilder, Start-Glitch, Logo-Verweise, gekreuzte Pose, native Fokus-Anbindung, Preisvergleich und Paywall-Zustände. Fünf weitere Integrationsprüfungen sichern SDK-Bereitschaft, Kauf- und Wiederherstellungsmeldungen, App-Kennungen und die Release-Konfiguration ab. Ein erfolgreicher TypeScript-Check und eine erfolgreiche Bündelung ersetzen keinen Gerätetest.

Zusätzliche Offline-Prüfung der HTML-Bereinigung:

```sh
pytest -c /dev/null -q backend/tests/test_html_sanitize.py -k test_to_text
```

## Ergebnis der 40 echten Angebotsprüfungen

Die geschichtete Stichprobe umfasst vier Preisfehler, vier Lieferdienst-Einträge, acht Code-Vault-Einträge, vier weitere Gutscheine, vier Stapel, zwei Cashback-Einträge, zwei Versand-Einträge und zwölf allgemeine Deals. Alle 40 Originalbeiträge wurden gelesen. 30 Datensätze enthielten kein gespeichertes Händlerziel; zehn enthielten lediglich eine Händler-Startseite. Die Stichprobe ist nach Bereich und Aktualität ausgewählt und keine repräsentative Zufallsauswahl. Die App-Daten stammen aus dem damals erreichbaren [Testraum](https://error-scout-20.preview.emergentagent.com/api/glitches); die Einzelbelege und Bedingungen stehen in der vollständigen 40er-Tabelle.

- **Kritisch falscher TV-Preis:** Die App führte 1,21 €; der Originalbeitrag nennt 1.215,27 € einschließlich mehrerer Bedingungen. Ein niedriger KI-Erfolgsscore verhindert diese falsche Preisanzeige nicht. ([App-Detail](https://error-scout-20.preview.emergentagent.com/api/glitches/6af1a562eea38b93775b27e1), [Originalbeitrag](https://www.mydealz.de/deals/conrad-pro-lg-oled65c6elb-65-zoll-4k-oled-evo-ai-tv-alpha11-vrr-bis-165hz-webos-26-120hz-ohne-geschenkgutscheine-130627-2867338))
- **Status- und Bedingungsfehler:** Drei als aktiv geführte Einträge waren auf der Quelle als abgelaufen markiert; weitere Fehler betreffen ein erst später startendes Filialangebot im Lieferdienstbereich und eine personalisierte Übergangsleistung statt eines allgemeinen 90-Tage-Angebots. Die sechs Fälle sind im Einzelbericht mit ihren jeweiligen Originalbelegen dokumentiert.
- **Nicht pauschal falsch:** Fehlende Händlerbestätigung oder ein Bot-Schutz sind keine bewiesenen falschen Angebote. Rabattbetrag, Mindestbestellwert, Monatsrate und Warenpreis werden getrennt bewertet; ohne Einlösung im Warenkorb ist kein Code als sicher funktionierend freigegeben.
- **Grenze:** 19 Detail-API-IDs wurden bestätigt, danach fiel die Vorschau aus. Kein Eintrag wird als vollständig auf Android geprüfter Kaufablauf ausgegeben; es wurde nichts bestellt oder bezahlt.

Die ursprüngliche größere Backend-Testsammlung bleibt ebenfalls keine Live-Freigabe: Der frühere Lauf ergab 46 Fehlschläge und sechs Setup-Fehler bei 14 bestandenen Tests, darunter nicht erreichbare HTTP-Ziele und Event-Loop-Annahmen alter Test-Fixtures. Das ist von den oben erfolgreich ausgewählten Offline-Tests getrennt zu betrachten.

## Entscheidung über strengere Aufnahme

Die Stichprobe belegt die Notwendigkeit strengerer Preis-, Status-, Bedingungs- und Zielprüfung. Diese zusätzlichen Regeln wurden noch nicht als live ausgerollt behauptet; der irreführende Startseiten-Fallback ist im zusammengeführten Quellcode bereits korrigiert, aber der laufende Vorschau-Commit ist nicht verifiziert. Ein GitHub-Merge allein aktualisiert keine Vorschau.

Vor Aufnahme müssen insbesondere Tausendertrennzeichen korrekt verarbeitet, abgelaufene Quellen ausgesondert und Codes, Region, Startzeit, Mitgliedschaft sowie Versandbedingungen geprüft werden. Ungeklärte Fälle gehören in eine Nachprüfung und nicht in eine vermeintlich sichere Kaufempfehlung. Eine KI-Risikoeinschätzung ist kein Verfügbarkeitsnachweis.

## Vor dem Beta-Start noch erforderlich

- **Live-Stand:** Änderungen im aktuellen Testraum übernehmen und dort den echten Start-/Lade-/Such-/Detailablauf wiederholen.
- **Ressourcen:** Den Prozess-/Speicherverbrauch im laufenden Deployment diagnostizieren, gezielt entlasten und die Wirkung bei echter Nutzung messen. Kein kostenpflichtiges Upgrade ohne Zustimmung.
- **Angebotsqualität:** Die dokumentierten 40er-Befunde korrigieren und die Fälle erneut prüfen; anschließend Händler-/Android-Kaufpfade vervollständigen.
- **Android-Gerät:** Installation, Kaltstart, langsames/offlines Netz und Öffnen externer Angebotsziele prüfen.
- **Play Console:** Bestehende App-ID, Signierung, Release-Artefakt und vorgesehenen Testkanal prüfen. Es wurde noch kein Release eingereicht.
- **Freigabe:** Kein Beta-Start als „fertig“ melden, solange diese Nachweise fehlen.
