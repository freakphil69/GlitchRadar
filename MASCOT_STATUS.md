# Einheitliches Maskottchen-Logo und geringer Zusatzaufwand

Stand: 7. November 2026. Die vom Nutzer freigegebenen Figuren sind als Bilder integriert und ersetzen auf erneuten Wunsch auch das bisherige Logo. Neu freigegeben ist ein einmaliger kurzer Glitch-Auftritt beim Start. Aufwendige Figurenanimation und zusätzlicher Intro-Ton bleiben für später. Keine neuen Bildgenerierungen für die Integration.

## Einbindung

- **Startbildschirm:** Neutrale Figur mit Beinen, statische Radar-Ringe und Markenname. Ein 350-ms-Glitch mit fünf kurzen Schritten verändert nur Transparenz und horizontalen Versatz, auf Android mit nativem Animationstreiber. Keine Schleife. „Bewegung reduzieren“ überspringt beziehungsweise beendet den Effekt; Unmount und Ablauf stoppen ihn ebenfalls. Ein einzelner aufgeräumter Timeout blendet den Startbildschirm nach 1,8 Sekunden aus.
- **Einheitliches Logo:** Neutrale Figur im Hauptseiten-Ticker, Paywall-Kopf und der Teilen-Karte. Launcher-Icon, adaptives Android-Icon, natives Splash-Bild, Favicon und Play-Store-Icon wurden aus der vorhandenen Figur abgeleitet, ohne KI-Generierung. Native Icons/Splash werden erst mit einem neuen App-Build sichtbar.
- **Paywall:** Präsentierpose mit Daumen hoch links vom Jahrespreis. Der Betrag kommt weiterhin aus dem Store-Angebot. Die prozentuale Ersparnis wird nur aus positiven, endlichen Jahres- und Monatspreisen derselben Währung berechnet. Der Text nennt ausdrücklich den Vergleich mit zwölf Monatszahlungen, keinen erfundenen Sonderrabatt.
- **Aktives PRO:** Stolze Figur mit Händen an den Hüften neben der vorhandenen Bestätigung.
- **Unverändert:** Kauf-/Wiederherstellungsaufrufe, Aboprodukte, Server-Scan-Takt und die bisherigen Backend-Kostenbremsen.

## Ressourcen

Die drei lokal gebündelten transparenten WebP-Dateien sind auf maximal 480 Pixel je Kante begrenzt:

| Datei | Abmessungen | Dateigröße |
| --- | --- | --- |
| `neutral.webp` | 423 × 480 | 31.154 Bytes |
| `proud.webp` | 374 × 480 | 32.824 Bytes |
| `offer.webp` | 480 × 473 | 33.406 Bytes |
| Zusammen | | 97.384 Bytes |

Die wiederverwendbare Bildkomponente enthält weder Netzwerkadressen noch Timer, KI-Aufrufe oder Animationen. Androids Bild-Einblendanimation ist deaktiviert. Nur der Startbildschirm ergänzt den separaten einmaligen 350-ms-Effekt. Bilder benötigen beim Dekodieren und Anzeigen selbstverständlich etwas Speicher und Rechenzeit; „kostenlos“ oder „null CPU“ wird nicht behauptet. Die 97.384 Bytes gelten für die drei WebP-Figuren, nicht für die separat abgeleiteten nativen PNG-Icons.

Zusätzlich verbindet `query-focus.ts` den nativen AppState mit dem bestehenden TanStack-Query-Fokusmanager. Die regelmäßigen Query-Leseabfragen werden bei inaktiver App nicht weiter ausgelöst; bei Rückkehr greifen die bestehenden Aktualisierungsregeln. Web behält seine vorhandene Dokument-Sichtbarkeitserkennung. Laufende Requests werden nicht abgebrochen. Die sichtbaren Abfrageintervalle und serverseitigen Scans werden nicht verlangsamt. Andere vorhandene Timer und Animationen wurden in diesem eng begrenzten Schritt nicht pauschal umgebaut.

Die vorausgewählte Abo-Option wird jetzt direkt aus dem Angebot abgeleitet, statt nach dem Rendern ein weiteres State-Update auszulösen. Eine manuelle Auswahl bleibt erhalten, solange das gewählte Paket verfügbar ist.

## Verifikation

- **Frontend-Tests:** `npm run test:beta`, nun 17 Tests einschließlich einmaligem Glitch, Reduzierter Bewegung, Animation-Cleanup, spätem Async-Ergebnis und einheitlichen Logo-Verweisen.
- **TypeScript:** `npx tsc --noEmit`, bestanden.
- **Gezieltes Lint:** `AppSplash.tsx`, `Ticker.tsx`, `pro.tsx` und `share-savings.tsx` bestanden.
- **Android-Export:** `CI=1 npx expo export --platform android`, erfolgreich; alle drei WebP-Dateien sind enthalten. Das ist kein signiertes AAB und kein Gerätetest.
- **Layout:** Lokale Browser-Prüfung mit 320 und 390 Pixel Breite; Start, Paywall und PRO-Bestätigung geprüft. Dafür wurden die echten Bildschirmkomponenten serverseitig gerendert, Billing/Auth und Bild-Dekodierung für die Layoutansicht ersetzt und Testpreise verwendet. Kein echter Store-Aufruf, kein Kauf und keine Live-App-Prüfung.
- **Nach dem Logo-Wechsel:** Die SSR-Paywall zeigte die Figur auch im Kopf statt des alten Logos. Der erneute mobile Browser-Prüflauf war wegen einer nicht erreichbaren lokalen Vorschau nicht abschließbar. Der native Glitch wurde mit Unit-Stubs und Android-Bündelung geprüft, nicht visuell auf einem Android-Gerät. Die frühere mobile Layoutprüfung ersetzt diesen offenen Test nicht.

## Übergabe und Grenzen

Die Änderungen liegen auf `beta-core` zusammen mit dem vorhandenen Sparbetrieb. Sie verändern `main`, den Emergent-Testraum und eine installierte App nicht automatisch. Vor einem Release müssen der aktuelle Stand in Emergent übernommen und die native Bilddarstellung, Kaltstart, Hintergrund/Rückkehr sowie CPU und Akku auf einem Android-Gerät geprüft werden. Die offenen Beta-Punkte aus `BETA_STATUS.md` bestehen weiter.
