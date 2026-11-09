# GitHub-Berechtigungen für GlitchRadar

## Bestehende GitHub-App prüfen

1. GitHub: Profilbild > Settings > Applications > Installed GitHub Apps.
2. Bei der verwendeten Integration auf Configure klicken.
3. Unter Repository access > Only select repositories das Repository GlitchRadar auswählen und speichern.
4. Unter Permissions die angeforderten Rechte prüfen und gegebenenfalls ausstehende zusätzliche Berechtigungen genehmigen.

Bei einer fremden GitHub App legt der Anbieter die angeforderten Berechtigungen fest. Nutzer können nicht beliebige zusätzliche Rechte aktivieren.

## Optional: Fine-grained Personal Access Token

Nur erforderlich, wenn die Integration diese Anmeldemethode ausdrücklich unterstützt.

1. Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.
2. Namen und Ablaufdatum festlegen.
3. Resource owner: freakphil69.
4. Repository access: Only select repositories > GlitchRadar.
5. Nur die benötigten Repository permissions vergeben:

| Berechtigung | Zugriff und Zweck |
| --- | --- |
| Contents | Read and write: Code, Commits und Branches |
| Pull requests | Read and write: Pull Requests verwalten |
| Issues | Read and write, falls Issue-Verwaltung benötigt wird |
| Actions | Read-only für Runs und Logs; Read and write für Run-Verwaltung |
| Workflows | Write zum Ändern von Workflow-Dateien |

Keine pauschalen Administrations-, Secrets- oder Organisationsrechte vergeben. Tokens niemals im Chat, im Repository oder in dieser Datei speichern; ausschließlich in der sicheren Konfiguration der Integration hinterlegen.

## Grenze des aktuell verfügbaren Connectors

Stand der Prüfung: 9. November 2026. Der in der Unterhaltung verfügbare GitHub-Connector bietet Datei-, Branch-, Commit-, Issue- und Pull-Request-Werkzeuge, aber keine Werkzeuge zum Abrufen von Actions-Runs oder deren Logs. Zusätzliche GitHub-Berechtigungen allein ergänzen diese fehlenden Werkzeuge nicht. Die tatsächlichen Schreibrechte der Verbindung wurden noch nicht getestet.

## Quellen

- https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
