# Outreach Mission Control

Stand: 2026-06-30

Quelle: Code-Review-Council (Architect, Engineer, User-Advocate, Security, Devil's Advocate), anschliessende Umsetzung auf `main`, Tests und Build.

## Aktueller Status

Das Outreach-Modul ist nach dem Council-Review auf `main` bereinigt und gehaertet. P0-P3 aus dem Verbesserungsplan sind umgesetzt und gepusht. Das Modul kann jetzt als Strategie-, Ressourcen- und Kampagnen-Generator weiterentwickelt werden; der echte Versand-Pfad ist bewusst noch nicht gebaut.

## Erledigt

### P0 - Security, Billing, Tenant Scope

- Credit-Reservierung und Refund sind retry-idempotent ueber `inngestEventId`/Reservation-Key abgesichert.
- Fehlerpfade in `outreachStrategy` und `outreachIntelligence` markieren Jobs als `failed` und erstatten reservierte Credits.
- Worker-Queries und Worker-Writes pruefen `userId` + `workspaceId`, damit keine Cross-Tenant-Daten in Prompts oder Writes rutschen.
- `bodycamPages` wurde aus dem Outreach-Intelligence-Kontext entfernt.
- Sitemap-/Website-Fetch laeuft ueber SSRF-Guard (`src/inngest/lib/safeHttp.ts`): nur http/https, Port 80/443, keine privaten/reservierten IPs, keine stillen Redirects.
- Worker-Secret-Vergleich ist constant-time.

Commits: `01650e9`, `2633d4e`

### P1 - Qualitaet und Fehlerverhalten

- KI-generierte Kontaktdaten werden als `unverified` gespeichert und sind damit nicht versandfaehig.
- Fallback-Kampagnen werden als `needs_review` markiert, nicht als fertige `ready`-Kampagnen.
- `outreachStrategy` nutzt eine konsistente Event-/Job-ID.
- `updateGoal` setzt `verifiedAt` sauber zurueck, wenn ein Ziel nicht mehr verifiziert ist.

Commit: `6a6915f`

### P2 - Architektur und Tests

- Outreach-Validierungen sind zentralisiert (`convex/lib/outreachValidators.ts`).
- Gemeinsames `stripUndefined` liegt in `convex/lib/objects.ts`.
- Outreach nutzt das kanonische `requireProjectAccess`.
- Tote `outreachAssets`-Tabelle und tote Bundle-Abfrage wurden entfernt.
- `latestByProject` nutzt den Index statt collect+Sort.
- `npm test` laeuft ueber `scripts/tests/run-all.ts`.

Commit: `840cb60`

### P3 - UX und Produktklarheit

- Campaign-Detail pollt den Strategie-Job-Status ueber `getJobStatusByEventId`.
- Strategie-Button ist waehrend queued/running gesperrt.
- Fehler-Toasts und Pflichtfeldvalidierung fuer Prospect-Status, Goals und Placements sind drin.
- CSV-Import erkennt Header, liest `contactName`, zeigt Preview und meldet ungueltige Zeilen.
- Strategie-Tab hat einen echten Empty-State mit CTA.
- Placement/Goal validieren URL-Format; `rel` ist ein Select (`dofollow`, `nofollow`, `sponsored`, `ugc`).

Commit: `e32ec7f`

### Ressourcen-Planer / Linkbait-Ideen

- Outreach Intelligence plant jetzt redaktionell verlinkbare Ressourcen statt nur vorhandene Seiten zu verwerten.
- Neue Ideen sind explizit moeglich (`new_ideas`/`full`), vorhandene Assets und Content dienen als Rohmaterial.
- Unterstuetzte Formate: Ratgeber, Broschuere, Checkliste, Experteninterview, Gruppeninterview, Analyse, Umfrage, Whitepaper, Rechner, Tool, Vorlage, Glossar, Presse-Ressource, Notfallkarte, interaktive Visualisierung und Ressourcenliste.
- Ressourcenplaene haben Bewertung, Zielgruppen, Outreach-Rohmaterial und ein Claude-Code-Briefing.
- UI-Komponenten fuer Ressourcenplan-Karten und Detaildialog sind vorhanden.

Commits: `8a595d8` bis `1944406`

## Verifiziert

- `npm test` erfolgreich.
- `npm run build` erfolgreich.
- `main` ist sauber und synchron mit `origin/main`.

## Offene Blocker / Risiken

1. **Prod-Secret noch nicht finalisiert.** In Vercel/Convex wurde kein `OUTREACH_WORKER_SECRET` gefunden. Der Code behaelt deshalb vorerst den expliziten Fallback auf `INNGEST_EVENT_KEY`, damit Live nicht bricht. Naechster Security-Schritt: `OUTREACH_WORKER_SECRET` in Vercel + Convex setzen, dann Fallback entfernen.
2. **Convex Deploy/Codegen nicht lokal verifiziert.** Der lokale Account hatte keinen Zugriff auf das ausgewaehlte Convex-Projekt. Tests/Build sind gruen, aber Convex-Deploy braucht Zugriff oder muss ueber die Live-Pipeline laufen.
3. **Echter Versand fehlt bewusst.** Sequenzen/Kampagnen koennen geplant werden, aber es gibt noch keine Outbox, keinen Mailversand, keine Mailbox-Rotation, kein Reply-Management und kein Warm-up.
4. **DA/Tier bleiben KI-Schaetzungen.** Solange keine echte Datenquelle angebunden ist, muessen Scores als KI-Einschaetzung behandelt werden.

## Naechste Reihenfolge

### Modul 1b - Versand-Pfad

Ziel: aus Strategie und Sequenzentwurf einen kontrollierten, rechtlich und technisch sauberen Versandprozess bauen.

- Outbox-Tabelle mit Scheduling, Status, Retry, Error, Provider-Message-ID.
- Versand-Provider-Abstraktion zuerst generisch, dann z.B. SMTP/Resend als Adapter.
- Suppression-Liste technisch erzwingen.
- Consent-/Rechtsgrundlage pro Outreach-Typ speichern.
- Opt-out/Abmelde-Link + Impressum in jede Versandmail.
- Kontakt-Verifikation vor Versand erzwingen; `unverified` darf nicht gesendet werden.
- Prospect-Status-Uebergang nach Versand (`contacted`, `replied`, `bounced`, `suppressed`).
- Audit-Log fuer Versandereignisse.

### Modul 1c - Deliverability / Warm-up

Ziel: Woodpecker-artige Kernfunktionen selbst besitzen, ohne externes Tool als Betriebssystem.

- Mailbox-Identitaeten, Tageslimits, Ramp-up, Cooldowns.
- Rotation nach Kampagne, Projekt und Domain.
- Bounce-/Reply-Signale auswerten.
- Spam-Risiko-Regeln vor Versand.
- Domain-/Mailbox-Gesundheit als Dashboard.

### Modul 2 - Social / PR / Sales als gleiche Outreach-Basis

Ziel: Outreach bleibt generisch. SEO-Linkbuilding ist ein Playbook, nicht das Datenmodell.

- Kampagnentypen fuer PR, Sales, Partnerships, Seeding.
- Andere Prompt-Profile und Sequenz-Tonality pro Use Case.
- Ressourcen-/Leadmagnet-Planer auch fuer LinkedIn/Sales/PR nutzbar machen.

### 2. Council-Loop

Nach Modul 1b/1c: erneuter Review mit Fokus auf Billing, Recht/Compliance, Deliverability, Tenant-Isolation, UX und echte End-to-End-Testbarkeit.
