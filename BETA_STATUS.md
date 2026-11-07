# GlitchRadar: Beta-Prüfstand

Stand: 7. November 2026. Ziel ist ein zuverlässiger Start und der Kernablauf „Funde laden, suchen, öffnen und zur richtigen Quelle gelangen“. Dieser Stand ist keine Freigabe zur Veröffentlichung.

## Ergebnis bisher

- **Grundlage:** Der Arbeitszweig `beta-core` enthält die bisherigen Änderungen aus `sparbetrieb`, einschließlich Kostenbremse, FAQ und Feedback. `main` und die laufende App werden dadurch nicht automatisch verändert.
- **Lokale Tests:** Der frühere Backend-Prüflauf umfasst 11 bestandene Tests. Nach Zusammenführung der neueren Startbildschirm-Änderung mit Otto mit verschränkten Armen bestehen am 7. November alle 18 Frontend-Tests, TypeScript, gezieltes Lint und Android-Export.
- **Android-Bündel:** Die JavaScript-/Asset-Bündelung wurde nach Behebung des Versionskonflikts erfolgreich durchgeführt. Das ist kein signiertes AAB und kein Installationstest auf einem Android-Gerät.
- **Echte Angebotsstichprobe:** Noch nicht durchgeführt. Es wurden ausdrücklich nicht 40 Test-Fixtures als echte geprüfte Angebote gezählt.
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

Die ursprünglichen sieben Frontend-Tests prüfen URL-Normalisierung, Auth-Header, fehlende Konfiguration, Timeout, HTTP-Statusbehandlung sowie drei RevenueCat-Startfälle. Elf ergänzende Tests prüfen die Bilder, den einmaligen Start-Glitch, Logo-Verweise, die ausdrücklich gewählte gekreuzte Pose im kleinen Ticker-Logo, die native Fokus-Anbindung, die Preisvergleichslogik und Paywall-Zustände. Ein erfolgreicher TypeScript-Check und eine erfolgreiche Bündelung ersetzen keinen Gerätetest.

## Warum die echte 40er-Prüfung noch offen ist

Der aus dem bisherigen Projekt bekannte [Vorschau-Endpunkt](https://error-scout-20.preview.emergentagent.com/api/glitches) lieferte bei der Prüfung HTTP 404. In dieser Sitzung zeigt [Emergent](https://app.emergent.sh/) die Anmeldeseite, nicht den aktuellen Testraum.

Bei der erneuten Prüfung am 7. November zeigte die bisherige Vorschau lediglich eine Ladeansicht, keinen bedienbaren Angebotsbestand. Der Google-Anmeldedialog für die Play Console ist geöffnet; der Beleg über die Entwicklerregistrierungsgebühr wurde im verbundenen Postfach gefunden. Der Beleg bestätigt weder die tatsächliche Kontozuordnung der App noch fertige Abos oder einen eingerichteten Testkanal. Passwörter wurden nicht eingegeben und kein Release eingereicht.

Auch die vorhandene größere Backend-Testsammlung ist keine bestandene Live-Prüfung: Der Lauf ergab 46 Fehlschläge und 6 Setup-Fehler bei 14 bestandenen Tests. Die HTTP-basierten Tests treffen den nicht verfügbaren alten Vorschau-Endpunkt; vier Setup-Fehler betreffen außerdem die Event-Loop-Annahme alter Test-Fixtures unter der hier verwendeten Python-Version. Diese Ergebnisse sind weder als 46 nachgewiesene Produktfehler noch als bestandener Beta-Test zu interpretieren.

Benötigt wird der aktuelle erreichbare Testraum mit seinem echten Angebotsbestand, entweder über die Emergent-Anmeldung oder einen funktionierenden aktuellen Vorschau-Link. Es ist keine erneute Freigabe für GitHub nötig; der Quellcode ist bereits zugänglich.

## Ausstehende Prüfung von 40 echten Angeboten

Aus dem tatsächlichen App-Bestand werden 40 verschiedene Angebote ausgewählt. Die Verteilung soll vorhandene Angebotsarten, Händler und Quellen abdecken, nicht nur die am leichtesten prüfbaren Einträge.

Für jeden Eintrag werden festgehalten:

- **App-Angaben:** ID, Titel, Produkt/Variante, Händler, Preis, Code, angegebene Bedingungen und Zeitstempel.
- **Tatsächliches Ziel:** ursprünglicher Aktionslink, Weiterleitungen, finale Seite und Übereinstimmung mit dem konkreten Angebot.
- **Nachweis:** öffentlich erreichbare Angebots-/Händlerseite, Prüfzeitpunkt und die dort tatsächlich belegbaren Angaben.
- **Preis und Bedingungen:** gleicher Artikel und gleiche Variante, Versand, Mindestbestellwert, Neukunden-/App-/Regionsbindung, Gutscheincode und Laufzeit.
- **Status:** bestätigt, nachweislich falsch/abgelaufen oder nicht überprüfbar. Eine Bot-Sperre oder fehlende Nachweismöglichkeit zählt nicht als bestanden.
- **Grenze:** Keine Bestellung, kein Kauf und keine Zahlung. Ein Code gilt ohne technisch mögliche Warenkorbprüfung nicht als nachweislich eingelöst.

## Entscheidung über strengere Aufnahme

Es wurde noch kein pauschaler Filter eingeführt, der möglicherweise gute Angebote ohne tatsächliche Stichprobe entfernt. Der nachgewiesene irreführende Startseiten-Fallback ist unabhängig davon korrigiert.

Nach der Stichprobe werden Fehlerquote und Ursachen getrennt ausgewertet. Erst dann werden konkrete Aufnahme- und Aktualitätsregeln angepasst, etwa für falsche Ziele, unklare Preisübernahme, abgelaufene Aktionen und fehlende Bedingungen. Eine KI-Risikoeinschätzung oder Regelbewertung ist dabei kein Nachweis, dass ein Angebot aktuell tatsächlich funktioniert.

## Vor dem Beta-Start noch erforderlich

- **Live-Stand:** Änderungen im aktuellen Testraum übernehmen und dort den echten Start-/Lade-/Such-/Detailablauf wiederholen.
- **Angebotsqualität:** Die 40er-Stichprobe durchführen, Fehler beheben und denselben Prüfmaßstab erneut anwenden.
- **Android-Gerät:** Installation, Kaltstart, langsames/offlines Netz und Öffnen externer Angebotsziele prüfen.
- **Play Console:** Bestehende App-ID, Signierung, Release-Artefakt und vorgesehenen Testkanal prüfen. Es wurde noch kein Release eingereicht.
- **Freigabe:** Kein Beta-Start als „fertig“ melden, solange diese Nachweise fehlen.
