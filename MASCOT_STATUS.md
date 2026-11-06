# Statische Maskottchen und geringer Zusatzaufwand

Stand: 7. November 2026. Die vom Nutzer freigegebenen Figuren sind als Bilder integriert. Animation, Glitch-Verwandlung und zusätzlicher Intro-Ton bleiben ausdrücklich für später. Keine neuen Bildgenerierungen für die Integration.

## Einbindung

- **Startbildschirm:** Neutrale Figur mit Beinen, statische Radar-Ringe und Markenname. Die bisherige endlose Radar-Animation ist entfernt. Ein einzelner aufgeräumter Timeout blendet den Startbildschirm nach 1,8 Sekunden aus.
- **Paywall:** Präsentierpose mit Daumen hoch links vom Jahrespreis. Der Betrag kommt weiterhin aus dem Store-Angebot. Die prozentuale Ersparnis wird nur aus positiven, endlichen Jahres- und Monatspreisen derselben Währung berechnet. Der Text nennt ausdrücklich den Vergleich mit zwölf Monatszahlungen, keinen erfundenen Sonderrabatt.
- **Aktives PRO:** Stolze Figur mit Händen an den Hüften neben der vorhandenen Bestätigung.
- **Unverändert:** App-Icon, Kauf-/Wiederherstellungsaufrufe, Aboprodukte, Server-Scan-Takt und die bisherigen Backend-Kostenbremsen.

## Ressourcen

Die drei lokal gebündelten transparenten WebP-Dateien sind auf maximal 480 Pixel je Kante begrenzt:

| Datei | Abmessungen | Dateigröße |
| --- | --- | --- |
| `neutral.webp` | 423 × 480 | 31.154 Bytes |
| `proud.webp` | 374 × 480 | 32.824 Bytes |
| `offer.webp` | 480 × 473 | 33.406 Bytes |
| Zusammen | | 97.384 Bytes |

Die Bildkomponente enthält weder Netzwerkadressen noch Timer, KI-Aufrufe oder Animationen. Androids Bild-Einblendanimation ist deaktiviert. Bilder benötigen beim Dekodieren und Anzeigen selbstverständlich etwas Speicher und Rechenzeit; „kostenlos“ oder „null CPU“ wird nicht behauptet.

Zusätzlich verbindet `query-focus.ts` den nativen AppState mit dem bestehenden TanStack-Query-Fokusmanager. Die regelmäßigen Query-Leseabfragen werden bei inaktiver App nicht weiter ausgelöst; bei Rückkehr greifen die bestehenden Aktualisierungsregeln. Web behält seine vorhandene Dokument-Sichtbarkeitserkennung. Laufende Requests werden nicht abgebrochen. Die sichtbaren Abfrageintervalle und serverseitigen Scans werden nicht verlangsamt. Andere vorhandene Timer und Animationen wurden in diesem eng begrenzten Schritt nicht pauschal umgebaut.

Die vorausgewählte Abo-Option wird jetzt direkt aus dem Angebot abgeleitet, statt nach dem Rendern ein weiteres State-Update auszulösen. Eine manuelle Auswahl bleibt erhalten, solange das gewählte Paket verfügbar ist.

## Verifikation

- **Frontend-Tests:** `npm run test:beta`, alle 15 bestanden. Davon acht neue Tests für statische Assets, Start-Timeout, nativen Hintergrundstatus, Web-Ausnahme, Rabattberechnung und Paywall-Zustände einschließlich Tarifauswahl.
- **TypeScript:** `npx tsc --noEmit`, bestanden.
- **Gezieltes Lint:** `npx eslint src/components/Mascot.tsx src/components/AppSplash.tsx src/lib/query-focus.ts src/lib/annual-saving.ts app/pro.tsx app/_layout.tsx`, bestanden.
- **Android-Export:** `CI=1 npx expo export --platform android`, erfolgreich; alle drei WebP-Dateien sind enthalten. Das ist kein signiertes AAB und kein Gerätetest.
- **Layout:** Lokale Browser-Prüfung mit 320 und 390 Pixel Breite; Start, Paywall und PRO-Bestätigung geprüft. Dafür wurden die echten Bildschirmkomponenten serverseitig gerendert, Billing/Auth und Bild-Dekodierung für die Layoutansicht ersetzt und Testpreise verwendet. Kein echter Store-Aufruf, kein Kauf und keine Live-App-Prüfung.

## Übergabe und Grenzen

Die Änderungen liegen auf `beta-core` zusammen mit dem vorhandenen Sparbetrieb. Sie verändern `main`, den Emergent-Testraum und eine installierte App nicht automatisch. Vor einem Release müssen der aktuelle Stand in Emergent übernommen und die native Bilddarstellung, Kaltstart, Hintergrund/Rückkehr sowie CPU und Akku auf einem Android-Gerät geprüft werden. Die offenen Beta-Punkte aus `BETA_STATUS.md` bestehen weiter.
