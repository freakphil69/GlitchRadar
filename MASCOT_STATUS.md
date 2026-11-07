# Einheitliches Maskottchen-Logo und geringer Zusatzaufwand

Stand: 7. November 2026. Die vom Nutzer freigegebenen Figuren sind als Bilder integriert und ersetzen auf erneuten Wunsch auch das bisherige Logo. Neu freigegeben ist ein einmaliger kurzer Glitch-Auftritt beim Start. Aufwendige Figurenanimation und zusätzlicher Intro-Ton bleiben für später. Keine neuen Bildgenerierungen für die Integration.

## Einbindung

- **Startbildschirm:** Otto mit verschränkten Armen, statische Radar-Ringe und Markenname. Der neu hinzugekommene 350-ms-Glitch mit fünf kurzen Schritten bleibt erhalten und verändert nur Transparenz und horizontalen Versatz, auf Android mit nativem Animationstreiber. Keine Schleife. „Bewegung reduzieren“ überspringt beziehungsweise beendet den Effekt; Unmount und Ablauf stoppen ihn ebenfalls. Ein einzelner aufgeräumter Timeout blendet den Startbildschirm nach 1,8 Sekunden aus.
- **Hauptseite oben:** Dieselbe Figur mit verschränkten Armen steht klein (28 × 36 Layoutpunkte) links im Ticker. Der bisherige Logo-Mark-Bildverweis ist dort entfernt.
- **Weitere Logo-Orte:** Die neutrale Variante bleibt im Paywall-Kopf, in der Teilen-Karte sowie den bereits abgeleiteten Launcher-, adaptiven Android-, nativen Splash-, Favicon- und Play-Store-Icons erhalten. Native Icons/Splash werden erst mit einem neuen App-Build sichtbar.
- **Paywall:** Präsentierpose mit Daumen hoch links vom Jahrespreis. Der Betrag kommt weiterhin aus dem Store-Angebot. Die prozentuale Ersparnis wird nur aus positiven, endlichen Jahres- und Monatspreisen derselben Währung berechnet. Der Text nennt ausdrücklich den Vergleich mit zwölf Monatszahlungen, keinen erfundenen Sonderrabatt.
- **Aktives PRO:** Stolze Figur mit Händen an den Hüften neben der vorhandenen Bestätigung.
- **Unverändert:** Kauf-/Wiederherstellungsaufrufe, Aboprodukte, Server-Scan-Takt und die bisherigen Backend-Kostenbremsen.

## Ressourcen

Die vier lokal gebündelten transparenten WebP-Dateien sind auf maximal 480 Pixel je Kante begrenzt:

| Datei | Abmessungen | Dateigröße |
| --- | --- | --- |
| `neutral.webp` | 423 × 480 | 31.154 Bytes |
| `proud.webp` | 374 × 480 | 32.824 Bytes |
| `offer.webp` | 480 × 473 | 33.406 Bytes |
| `crossed.webp` | 372 × 480 | 28.070 Bytes |
| Zusammen | | 125.454 Bytes |

Die wiederverwendbare Bildkomponente enthält weder Netzwerkadressen noch Timer, KI-Aufrufe oder Animationen. Androids Bild-Einblendanimation ist deaktiviert. Nur der Startbildschirm ergänzt den separaten einmaligen 350-ms-Effekt. Bilder benötigen beim Dekodieren und Anzeigen selbstverständlich etwas Speicher und Rechenzeit; „kostenlos“ oder „null CPU“ wird nicht behauptet. Die 125.454 Bytes gelten für die vier WebP-Figuren, nicht für die separat abgeleiteten nativen PNG-Icons.

Die Variante `crossed.webp` wurde am 7. November aus dem bereits freigegebenen Originalbild „glitchi-zwei-posen-freigabe.png“ ausgeschnitten, freigestellt und verkleinert. Es wurde kein neues Bild generiert. Die bisherige Variante `proud` mit Händen an den Hüften bleibt für die PRO-Bestätigung erhalten und wird nicht als Figur mit verschränkten Armen ausgegeben.

Zusätzlich verbindet `query-focus.ts` den nativen AppState mit dem bestehenden TanStack-Query-Fokusmanager. Die regelmäßigen Query-Leseabfragen werden bei inaktiver App nicht weiter ausgelöst; bei Rückkehr greifen die bestehenden Aktualisierungsregeln. Web behält seine vorhandene Dokument-Sichtbarkeitserkennung. Laufende Requests werden nicht abgebrochen. Die sichtbaren Abfrageintervalle und serverseitigen Scans werden nicht verlangsamt. Andere vorhandene Timer und Animationen wurden in diesem eng begrenzten Schritt nicht pauschal umgebaut.

Die vorausgewählte Abo-Option wird jetzt direkt aus dem Angebot abgeleitet, statt nach dem Rendern ein weiteres State-Update auszulösen. Eine manuelle Auswahl bleibt erhalten, solange das gewählte Paket verfügbar ist.

## Verifikation

- **Frontend-Tests:** `npm run test:beta` enthält nun 18 Tests einschließlich einmaligem Glitch, Reduzierter Bewegung, Animation-Cleanup, spätem Async-Ergebnis, einheitlichen Logo-Verweisen und der ausdrücklich ausgewählten gekreuzten Pose.
- **TypeScript:** `npx tsc --noEmit`, bestanden.
- **Gezieltes Lint:** Die bisherigen Maskottchen-, Hintergrundstatus- und Paywall-Dateien wurden im vorherigen Stand geprüft. Für die aktuelle Logo-Änderung: `npx eslint src/components/Mascot.tsx src/components/AppSplash.tsx src/components/Ticker.tsx`, bestanden.
- **Android-Export:** `CI=1 npx expo export --platform android`, erfolgreich im vorigen Stand; nach Zusammenführung wird der integrierte Stand erneut gebündelt. Das ist kein signiertes AAB und kein Gerätetest.
- **Layout:** Im vorherigen Stand lokale Browser-Prüfung mit 320 und 390 Pixel Breite für Start, Paywall und PRO-Bestätigung. Dafür wurden die echten Bildschirmkomponenten serverseitig gerendert, Billing/Auth und Bild-Dekodierung für die Layoutansicht ersetzt und Testpreise verwendet. Die aktuelle gekreuzte Pose wurde als Bild kontrolliert; der Ticker ist komponentengetestet, aber noch nicht im laufenden Testraum oder auf einem Android-Gerät geprüft. Kein echter Store-Aufruf, kein Kauf und keine Live-App-Prüfung.

## Übergabe und Grenzen

Die Änderungen liegen auf `beta-core` zusammen mit dem vorhandenen Sparbetrieb. Sie verändern `main`, den Emergent-Testraum und eine installierte App nicht automatisch. Vor einem Release müssen der aktuelle Stand in Emergent übernommen und die native Bilddarstellung, Kaltstart, Hintergrund/Rückkehr sowie CPU und Akku auf einem Android-Gerät geprüft werden. Die offenen Beta-Punkte aus `BETA_STATUS.md` bestehen weiter.
