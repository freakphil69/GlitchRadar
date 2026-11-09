# GlitchRadar: Ehrlichkeit und Linkfreigabe

Ein Quellenfund ist kein Kaufnachweis. GlitchRadar darf nur den tatsächlich erreichten Prüfstand benennen; eine technische Verkaufsseitenprüfung ist weder ein erfolgreich abgeschlossener Warenkorb noch eine Lieferzusage.

## Verbindliche Freigaberegel

- **Kauf-Link:** Nur bei aktivem Angebot ohne widersprüchlichen Preis und mit höchstens 15 Minuten altem Nachweis. Der Nachweis ist an genau URL, Titel, Produktkennung, Preis und Währung gebunden.
- **Identität:** SKU, GTIN oder eine andere konkrete Hersteller-/Produktkennung muss mit den strukturierten Produktdaten der Händlerseite übereinstimmen. Titelähnlichkeit allein reicht nicht. Eine Produktkennung wird nicht aus einem Titel geraten.
- **Verkaufsseite:** Eine eindeutige Offer-Angabe muss denselben Preis, EUR und Lagerbestand nennen. Eine passende Kaufaktion muss vorhanden sein. Startseiten, Fehlerseiten, HTTP 200 ohne Produktbeleg, uneindeutige Angebotslisten und fehlende Nachweise bestehen nicht.
- **Weiterleitungen:** Jeder Weiterleitungsschritt bleibt auf freigegebenen HTTPS-Händlerdomains; als URL angegebene IP-Adressen, Zugangsdaten in URLs, beliebige Fremdhosts und überlange Ketten werden nicht aufgerufen. Affiliate-Ziele benötigen einen eigenen erfolgreichen Check.
- **Unklarer Fall:** Kein Kauf-Link. Der Originalbeitrag bleibt als ausdrücklich ungeprüfter Quellenhinweis zugänglich. Bot-Schutz, JavaScript-only-Seiten oder fehlende Produktkennungen werden nicht als bewiesen falsche Angebote bezeichnet.
- **Erneute Prüfung:** Der Hintergrundlauf bearbeitet höchstens fünf fällige Datensätze nacheinander je Durchlauf. Veraltete Nachweise verlieren unabhängig vom Rückstau ihre Freigabe. Beim Öffnen lädt die App den aktuellen API-Stand erneut; bei API-Ausfall öffnet sie keinen alten Kauf-Link.

## Umsetzung und Grenzen

Die gemeinsame Ausgabefunktion des Backend-Modells entfernt nicht freigegebene Kauf- und Affiliate-Ziele aus Listen, Codes, Alarmen und Details. Der gemeinsame Frontend-Zielselektor prüft Nachweise zusätzlich, auch gegen alte Cache-Daten. Ein alter oder technisch nicht ausführbarer Check wird niemals durch einen KI-Score ersetzt.

Die Prüfung ist bewusst konservativ und noch kein vollständiger Warenkorb-/Gutscheintest. Strukturierte Händlerdaten können ebenfalls veraltet sein; weitere Bedingungen, Versand, Identität einer Variante ohne eindeutige Kennung und Änderungen nach der Prüfung bleiben Grenzen. Inline versteckte Kaufaktionen und mehrdeutige Produktlisten werden zurückgewiesen, aber externe CSS-Regeln und JavaScript-Zustände werden durch diesen HTML-Check nicht vollständig ausgewertet. Daher lautet die Oberfläche „Seite geprüft“, nicht „Kauf garantiert“.

Ein Import übernimmt eine Händleradresse und Produktkennung nur, wenn diese als explizite Feed-Metadaten vorliegen. Der neue Checker erfindet keine Deep-Links und löst nicht automatisch alle externen Originalbeiträge auf. Fehlen Adresse oder Identität, bleibt der Fund ungeprüft; diese Fälle sind noch keine erfolgreichen Kaufprüfungen.

## Weitere korrigierte Probleme

- **Preise:** Deutsche und internationale Tausender-/Dezimaltrennzeichen werden vollständig verarbeitet statt abgeschnitten. Widerspricht ein alter gespeicherter Preis einer eindeutigen führenden Preisangabe im Beschreibungstext, wird die Preis-/Rabattanzeige unterdrückt und ein Widerspruch angezeigt.
- **Codes und Einordnung:** Kurze explizite Codes wie RY7 werden erfasst. „Nicht kombinierbar“ wird nicht als Beleg für eine stapelbare Aktion behandelt.
- **KI:** Das Öffnen eines Angebots startet keine automatische kostenpflichtige Analyse. Gespeicherte Pläne bleiben vorhanden; neue Analysen werden ausdrücklich angefordert.
- **Ressourcen:** Feed-Downloads und Bildpuffer sind begrenzt; höchstens zwei Feed-Downloads beziehungsweise zwei Bildabrufe laufen gleichzeitig. Die Handelsseitenprüfung läuft sequenziell und mit begrenztem Rückstau-Budget. Das ist eine Absicherung gegen ungebremste Pufferung, kein Nachweis einer bereits gesunkenen Live-Speicherlast.
- **Darstellung:** Keine erfundene gemessene „Trefferquote“. Risikoeinschätzungen und ungeprüfte Kaufbarkeit werden getrennt dargestellt; FAQ und Analysehinweise benennen die Grenzen.

## Abnahme

Die Offline-Tests sichern die Freigabe-/Sperrlogik, genaue Produktkennung, Preisabweichung, Lagerstatus, deaktivierte Kaufaktion, Ablauf und Bindung von Nachweisen, unsichere Weiterleitungen, getrennte Affiliate-Prüfung, API-Ansichten, Begrenzung großer Antworten und den manuellen Analyseaufruf ab.

Für die Beta-Freigabe zusätzlich verpflichtend: Übernahme und Abgleich im echten Testraum, erneute reale Angebots-/Händlerprüfung, Android-Kernablauf und gemessene Ressourcen bei Nutzung. Ein grüner Offline-Lauf ersetzt keinen dieser Nachweise. Die ursprünglichen 40 Fälle werden nicht nachträglich als 40 erfolgreiche Kaufabschlüsse umetikettiert.
