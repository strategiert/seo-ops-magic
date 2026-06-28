# SEO Content Ops - Outreach Operating System

Stand: 2026-06-28 · Status: Produkt-/Architekturplan

Ziel: SEO Ops Magic bekommt ein eigenes Outreach Operating System. Es soll den gesamten Prozess abdecken: Strategie, Prospecting, Qualifizierung, Outreach, Mailbox-Deliverability, Warm-up, Versand, Reply-Management, Ziel-Tracking und Optimierung. Linkbuilding ist der erste vertikale Use Case. PR, Sales, Partnerships, Seeding und andere Outreach-Arten sollen spaeter auf derselben technischen Basis laufen. Externe Tools werden nicht als Kernbestandteil eingebunden. Wo APIs sinnvoll sind, bleiben sie optionale Datenquellen, nicht das Betriebssystem.

## Leitentscheidung

Wir bauen Woodpecker-artige Funktionen selbst nach und erweitern sie zu einem generischen Outreach-Kern. Woodpecker bleibt eine gute Referenz fuer UX und Prozesslogik, aber kein geplanter Pflichtanbieter.

Warum:
- Toolkosten sollen nicht mit jedem neuen Modul linear steigen.
- Versand, Sequenzen, Inbox-Rotation, Warm-up und Reporting sind Kerntechnologie fuer Outreach.
- SEO Ops Magic soll das Prozesswissen besitzen: Content-to-Outreach, nicht nur E-Mail-Automation.
- Daten und Lerneffekte bleiben im eigenen System.

## Recherche-Fundament

### Was Woodpecker gut macht

Aus oeffentlichen Woodpecker-Materialien:
- Kampagnen bestehen aus drei Kernfragen: was wird gesendet, von welcher Mailbox und an wen.
- Die Mailbox wird direkt angebunden; die Plattform versendet nicht wie ein Newsletter-Tool ueber Massenserver, sondern aus der verbundenen Mailbox.
- Versand erfolgt langsam und randomisiert, mit Zeitfenstern und Tageslimits.
- Follow-ups haben Prioritaet vor neuen Erstkontakten.
- Kampagnen haben Sequenzen, Personalisierungsfelder, Conditions, Testversand und Preview.
- Prospects koennen manuell, per CSV/XLSX oder aus einer bestehenden Datenbank hinzugefuegt werden.
- Statistiken werden auf Kampagnen-, Sequenz- und Prospect-Ebene gezeigt: Prospects, invalid, sent, queued, bounced, delivered, opened, responded, interest level.
- Der Prospects-Tab zeigt Antworten, Verlauf und Statuswechsel wie Blacklist.
- Woodpecker bewirbt Deliverability-Funktionen wie Warm-up, Inbox Rotation, Adaptive Sending, Domain Audit, Centralized Inbox und condition-based campaigns.

Quellen:
- Woodpecker Quickstart Campaign: https://woodpecker.co/blog/quickstart-guide-1-campaign/
- Woodpecker Sending Logic: https://woodpecker.co/blog/emails-followups-sending/
- Woodpecker Stats: https://woodpecker.co/blog/quickstart-guide-2-stats/
- Woodpecker Features: https://woodpecker.co/

### Was ComX als Prozess gut macht

Aus den weitergeleiteten ComX-Mails:
- ComX war kein reines Tool, sondern ein betreuter Operating-Prozess.
- Onboarding klaerte Zielmarkt, Blacklist, Mailboxen, Signaturen, Templates, Case Studies und Landing Pages.
- Vor Launch gab es Template-Freigabe, technische Mailbox-Pruefung und Testmails.
- Nach Launch wurden Antworten automatisch in positive, neutral und negative Kategorien sortiert.
- Weekly Digests zeigten positive Antworten, neutrale aber relevante Antworten, Rueckfragen, Empfehlungen, Check-backs, Feedback, Datenherkunftsfragen und Blacklisting.
- Review-Sessions bewerteten nicht nur Reply Rate, sondern Message-Market-Fit: genug Antworten, aber zu wenige positive Antworten fuehrten zu neuen Follow-up-Winkeln und besseren First-Impression-Assets.

Produktlektion: Unser Tool muss nicht nur E-Mails senden. Es muss den gesamten Outreach-Prozess fuehren. Linkbuilding, PR und Sales unterscheiden sich vor allem in Strategie, Kontaktlogik, Templates, Reply-Kategorien und Erfolgskriterien; die technische Versand- und Inbox-Infrastruktur ist identisch.

## Produktpositionierung

Name intern: Outreach Operating System

Kurzbeschreibung:
Ein System, das aus bestehendem Content Outreach-Kampagnen erzeugt, passende Prospects findet und bewertet, personalisierte Sequenzen versendet, Mailbox-Reputation schuetzt, Antworten klassifiziert und die Kampagne bis zum jeweiligen Ziel weitersteuert. Fuer Linkbuilding ist das Ziel ein gewonnener Link. Fuer PR ist es eine Veroeffentlichung, Erwaehnung oder Journalistenbeziehung. Fuer Sales ist es eine qualifizierte Antwort, ein Call oder ein Deal-Schritt.

Nicht bauen:
- Kein Harbor-Klon.
- Kein Ahrefs-/Semrush-Klon als erste Version.
- Kein vollstaendiges Sales-CRM als erste Version.
- Kein Newsletter- oder Massenmail-Tool.

Bauen:
- Content-first Outreach.
- Eigenes Outreach- und Deliverability-System.
- Gemeinsamer Outreach Core fuer Mailboxen, Sequenzen, Versand, Replies, Suppression und Reports.
- Vertikale Playbooks fuer Linkbuilding, PR, Sales und spaetere Outreach-Arten.

## Generischer Outreach Core

Der technische Kern muss unabhaengig vom Use Case bleiben:
- Mailboxen.
- Warm-up.
- Inbox Rotation.
- Sending Scheduler.
- Contacts.
- Prospects.
- Sequences.
- Personalization.
- Replies.
- Classification.
- Suppression.
- Weekly Digest.
- Campaign Analytics.
- Audit Trail.

Use-Case-spezifisch sind:
- Kampagnenstrategie.
- Prospect-Quellen.
- Scoring-Modell.
- Kontaktrollen.
- Sequenz-Templates.
- Reply-Taxonomie.
- Erfolgskriterium.
- Review-KPIs.

Kampagnentypen:
- `linkbuilding`: Ziel = gewonnener Backlink oder Placement.
- `pr`: Ziel = Presseerwaehnung, Interview, Zitat, Artikel, Podcast oder Beziehung.
- `sales`: Ziel = qualifizierte Antwort, Termin, Opportunity oder Deal-Schritt.
- `partnership`: Ziel = Kooperation, Co-Marketing, Integration oder Referral.
- `seeding`: Ziel = Produkt-/Content-Verbreitung ueber Multiplikatoren.

Die erste Umsetzung baut `linkbuilding`, aber Datenmodell, Worker und UI-Begriffe sollen nicht unnoetig auf Links festgenagelt werden.

## End-to-End-Prozess

### 1. Campaign Intake

Input:
- Projekt und Ziel-Domain.
- Zielseiten oder Artikel aus `articles`.
- Linkziele: neue referring domains, Ziel-Qualitaet, Zeitraum, Zielmaerkte.
- Wettbewerber-Domains.
- Ausschlusslisten: bestehende Kontakte, Kunden, Wettbewerber, No-Go-Domains.
- Optional: CSV-Import aus Ahrefs, Semrush, GSC, manueller Recherche oder bisherigen Kundenlisten.

Output:
- Kampagnenbrief.
- Linkable assets.
- Outreach-Positionierung.
- Erfolgskriterien.

### 2. Link Strategy

Der Agent erstellt eine Strategie pro Kampagne:
- Welche Artikel eignen sich als Linkziele?
- Welche Linkbuilding-Methoden passen?
- Welche Branchen, Seitentypen und Kontaktrollen sind relevant?
- Welche Suchoperatoren und Prospecting-Routen werden genutzt?
- Welche Outreach-Argumente sind glaubwuerdig?

Methoden:
- Resource Page Outreach.
- Broken Link Building.
- Guest Posting.
- Competitor Replication.
- Unlinked Mentions.
- Expert Quote / Source Outreach.
- Linkbait Promotion.
- Partner-/Tool-/Supplier-Links.
- Local/Industry Directory Links, wenn qualitativ passend.

### 3. Prospect Discovery

MVP:
- Manuelle Eingabe.
- CSV-/Paste-Import.
- Import vorhandener Backlink-Exports.
- Generierte Search-Operatoren fuer manuelle Recherche.

Phase 2:
- Eigener SERP-Collector, soweit technisch und wirtschaftlich sinnvoll.
- Eigener Crawler fuer gefundene Seiten.
- Sitemap-, RSS-, Blogroll-, Resource-Page- und Contact-Page-Erkennung.
- GSC-Daten als kostenlose Relevanzquelle.
- Optional einzelne Datenanbieter, aber austauschbar und nicht produktkritisch.

Discovery-Daten:
- Domain.
- Konkrete URL.
- Seitentyp.
- Thema.
- Vermutete Linkbuilding-Methode.
- Kontaktseite.
- E-Mail-Adressen.
- Autoren-/Editor-Namen.
- Relevante Textstellen fuer Personalisierung.

### 4. Qualification & Scoring

Score-Komponenten:
- Thematische Relevanz.
- Seitentyp und Linkwahrscheinlichkeit.
- Qualitaet des Inhaltsumfelds.
- Spam-/Risiko-Signale.
- Kontaktierbarkeit.
- Beziehung zum Zielartikel.
- Aufwand vs. erwarteter Linkwert.
- Optional importierte SEO-Metriken wie DA/DR, Traffic oder referring domains.

Tiers:
- A: hohe Relevanz, hoher Linkwert, personalisierter Outreach.
- B: solide Chance, Standard-Outreach mit Personalisierung.
- C: nur bei geringem Aufwand.
- D: nicht kontaktieren.

### 5. Contact Enrichment

Eigene Funktionen:
- Crawl von Kontakt-, Impressum-, About-, Team- und Autorenseiten.
- Mailto-Extraktion.
- Pattern-Erkennung fuer Redaktionskontakte.
- Kontaktformular-Erkennung.
- Dubletten-Merge ueber Domain, E-Mail und Kontaktrolle.
- Suppression gegen Blacklists.

Nicht im MVP:
- Teure B2B-Datenbanken.
- Vollautomatisches LinkedIn-Scraping.

### 6. Outreach Asset Builder

Pro Kampagne:
- Opening Mail.
- 2-3 Follow-ups.
- Varianten fuer Linkbuilding-Methode.
- Snippets fuer Artikelbezug, Ressource, broken link, Expertenzitat, Gastbeitrag.
- First-Impression-Assets: Landing Page, Case Study, Datenstudie, Linkbait, Kurzprofil.

UX:
- Editor mit Variablen wie `{{firstName}}`, `{{siteName}}`, `{{targetArticle}}`, `{{reason}}`, `{{brokenUrl}}`.
- Spam-/Risk-Check.
- Plain-text Preview.
- Testmail.
- Freigabe-Status vor Versand.

### 7. Mailbox Infrastructure

Wir bauen eine eigene Mailbox-Schicht:
- Gmail OAuth.
- Microsoft OAuth.
- IMAP/SMTP als Fallback.
- Pro Mailbox: Absendername, Signatur, Tageslimit, Zeitfenster, Zeitzone, Status.
- Verbindungspruefung und Reconnect-Flow.
- Kein Klartext-Passwortspeichern, wo OAuth oder App-Passwoerter moeglich sind.

Domain-Checks:
- MX.
- SPF.
- DKIM.
- DMARC.
- Domainalter via RDAP/WHOIS, soweit verfuegbar.
- Redirect-/Website-Signal.
- Blacklist-/Blocklist-Pruefung optional.

### 8. Warm-up Engine

Ziel: neue oder lange inaktive Mailboxen langsam aufwaermen und laufende Reputation stabil halten.

MVP-Warm-up:
- User verbindet eigene Seed-Inboxes oder von uns kontrollierte Seed-Inboxes.
- System sendet kleine Mengen natuerlich wirkender Warm-up-Mails.
- Empfaenger-Inbox antwortet, archiviert oder markiert positiv, soweit API/IMAP das erlaubt.
- Warm-up-Mails werden getaggt und aus normalen Kampagnenreports ausgeblendet.

Ramp-up-Regel:
- Start: 3-5 Warm-up-Mails pro Tag und Mailbox.
- Steigerung: +1 bis +3 pro Tag, wenn keine Bounce-/Auth-Probleme auftreten.
- Ziel: 25-30 kalte Outreach-Mails pro Tag und Mailbox plus Follow-ups.
- Neue Domains: mindestens 2-3 Wochen Schonphase.
- Sehr junge Domains: Warnung und niedrigere Limits.

Health-Signale:
- Bounces.
- Auth-Fehler.
- SMTP/IMAP-Fehler.
- Reply-Rate.
- Spam-Beschwerden, soweit erkennbar.
- Ploetzliche Zustellungsabbrueche.
- Provider-Limit-Nahe.

### 9. Inbox Rotation

Regeln:
- Eine Kampagne kann mehrere Mailboxen nutzen.
- Prospects werden nach Mailbox-Kapazitaet, Tageslimit und Health verteilt.
- Follow-ups bleiben bei der urspruenglichen Mailbox.
- Signatur und From-Name passen zur Mailbox.
- Bei Mailbox-Problemen werden neue Erstkontakte gestoppt, bestehende Follow-ups kontrolliert pausiert.
- Rotation beruecksichtigt Domains, damit nicht zu viele Mails gleichzeitig von einer Domain kommen.

### 10. Sending Scheduler

Kernlogik:
- Versand aus der verbundenen Mailbox.
- Randomisierte Sendezeitpunkte innerhalb erlaubter Fenster.
- Mindestabstand zwischen Mails.
- Tages- und Stundenlimits je Mailbox.
- Kampagnenlimits.
- Follow-ups vor neuen Erstkontakten.
- Feiertags-/Urlaubs-Pause.
- Reply stoppt alle offenen Follow-ups.
- Bounce stoppt Kontakt und markiert Prospect.
- Unsubscribe/Blacklist stoppt Domain oder Kontakt je nach Regel.

### 11. Central Inbox & Reply Classification

System liest Kampagnenantworten ueber Gmail/Microsoft/IMAP.

Antwortklassen fuer Linkbuilding:
- `link_opportunity`: positive Linkchance.
- `won_link`: Link wurde gesetzt.
- `needs_more_info`: Rueckfrage.
- `editor_referral`: Weiterleitung an bessere Kontaktperson.
- `not_now_checkback`: spaeter wieder melden.
- `price_or_sponsored_request`: will Geld/Sponsoring.
- `content_feedback`: inhaltliches Feedback.
- `source_question`: fragt nach Datenherkunft oder Kontext.
- `unsubscribe_blacklist`: nicht mehr kontaktieren.
- `autoreply`: Abwesenheit oder automatische Antwort.
- `lost`: keine Chance oder abgelehnt.

UX:
- Zentrale Inbox.
- Action Queue.
- AI-Zusammenfassung je Thread.
- Vorschlag fuer naechste Antwort.
- Snooze/Check-back.
- Statuswechsel direkt aus der Inbox.

### 12. Goal Verification

Fuer Linkbuilding nach positiver Antwort:
- Ziel-URL erfassen.
- Crawler prueft, ob Link existiert.
- Erkennung: Ziel-Domain, Ziel-URL, Anchor, dofollow/nofollow/sponsored/ugc, Platzierung.
- Recheck nach 7/30/90 Tagen.
- Lost-Link-Alerts.

Fuer spaetere Outreach-Arten:
- PR: Erwaehnung, Artikel, Podcast, Interview oder Zitat verifizieren.
- Sales: Termin, qualifizierte Antwort, Opportunity oder Deal-Schritt erfassen.
- Partnership: Kooperation, Referral, Co-Marketing-Asset oder Integration erfassen.

### 13. Weekly Digest & Review Cycle

Weekly Digest:
- Gewonnene Ziele, im Linkbuilding also gewonnene Links.
- Warme Chancen.
- Rueckfragen.
- Empfehlungen/Weiterleitungen.
- Check-backs.
- Preis-/Sponsored-Anfragen.
- Blacklist/Opt-outs.
- Bounces und Mailbox-Probleme.
- Beste und schlechteste Sequenzschritte.
- Naechste konkrete Aktionen.

Review nach 3-4 Wochen:
- Nicht nur Reply Rate, sondern positive Reply Rate.
- Welche Methode funktioniert?
- Welche Zielgruppe antwortet?
- Welche Artikel/Assets ziehen?
- Welche Follow-ups erzeugen Chancen?
- Welche Domains/Mailboxen performen schlechter?
- Entscheidung: weiterlaufen lassen, copy anpassen, Zielmarkt wechseln, Asset verbessern oder Kampagne stoppen.

## Datenmodell

Neue Tabellen in Convex:

### `outreachCampaigns`
- `projectId`
- `name`
- `campaignType`: `linkbuilding | pr | sales | partnership | seeding`
- `targetDomain`
- `targetArticleIds`
- `competitors`
- `goals`
- `strategyJson`
- `status`: `draft | warming | ready | active | paused | review | done`
- `createdAt`
- `updatedAt`

### `outreachAssets`
- `projectId`
- `campaignId`
- `articleId`
- `assetType`: `article | study | case_study | tool | infographic | landing_page`
- `url`
- `title`
- `pitchAngle`
- `status`

### `outreachProspects`
- `projectId`
- `campaignId`
- `campaignType`
- `domain`
- `url`
- `method`
- `score`
- `tier`
- `status`
- `reasoning`
- `contactStatus`
- `lastTouchedAt`

### `outreachGoals`
- `projectId`
- `campaignId`
- `prospectId`
- `goalType`: `backlink | press_mention | interview | quote | meeting | opportunity | partnership | referral`
- `targetUrl`
- `sourceUrl`
- `description`
- `status`: `open | won | lost | verified`
- `verifiedAt`
- `createdAt`

### `outreachContacts`
- `projectId`
- `prospectId`
- `name`
- `role`
- `email`
- `contactPage`
- `source`
- `suppressed`
- `suppressionReason`

### `outreachSequences`
- `projectId`
- `campaignId`
- `name`
- `steps`
- `variants`
- `approvalStatus`

### `outreachMessages`
- `projectId`
- `campaignId`
- `prospectId`
- `contactId`
- `mailboxId`
- `sequenceId`
- `stepIndex`
- `subject`
- `body`
- `scheduledAt`
- `sentAt`
- `status`: `draft | queued | sent | delivered | bounced | replied | stopped | failed`
- `providerMessageId`
- `threadId`

### `mailboxes`
- `projectId`
- `email`
- `provider`
- `displayName`
- `signature`
- `dailyLimit`
- `hourlyLimit`
- `minDelaySeconds`
- `maxDelaySeconds`
- `timezone`
- `sendWindows`
- `healthStatus`
- `warmupStatus`
- `lastHealthCheckAt`

### `mailboxHealthEvents`
- `projectId`
- `mailboxId`
- `eventType`
- `severity`
- `message`
- `createdAt`

### `warmupPlans`
- `projectId`
- `mailboxId`
- `startDailyVolume`
- `targetDailyVolume`
- `currentDailyVolume`
- `rampRate`
- `status`

### `replyEvents`
- `projectId`
- `campaignId`
- `prospectId`
- `contactId`
- `mailboxId`
- `threadId`
- `rawSnippet`
- `classification`
- `confidence`
- `suggestedAction`
- `createdAt`

### `suppressionList`
- `projectId`
- `scope`: `email | domain`
- `value`
- `reason`
- `createdAt`

### `linkPlacements`
- `projectId`
- `campaignId`
- `prospectId`
- `sourceUrl`
- `targetUrl`
- `anchorText`
- `rel`
- `firstSeenAt`
- `lastCheckedAt`
- `status`: `live | changed | lost`

## Architektur

### Frontend
- `src/pages/Outreach.tsx`: Kampagnen-Workspace fuer alle Outreach-Typen.
- `src/pages/OutreachCampaignDetail.tsx`: Strategie, Prospects, Sequenzen, Inbox, Reports.
- `src/components/outreach/*`: Campaign Intake, Prospect Table, Sequence Editor, Inbox Panel, Weekly Digest.
- `src/components/link-building/*`: Linkbuilding-spezifische Score-Badges, Link-Methoden, Placement-Verifikation.
- `src/pages/Mailboxes.tsx`: Mailboxen, Health, Warm-up, Sending Limits.

### Convex
- `convex/tables/outreachCampaigns.ts`: Campaigns, prospects, assets, goals.
- `convex/tables/linkBuilding.ts`: Linkbuilding-spezifische placements und Link-Methoden.
- `convex/tables/outreach.ts`: Contacts, sequences, messages, replies, suppression.
- `convex/tables/mailboxes.ts`: Mailbox config, health, warm-up.
- `convex/agents/triggers.ts`: Strategy, qualification, draft, send, classify, verify.

### Inngest / Worker
- `outreachStrategyAgent`: routet je `campaignType` zum passenden Playbook.
- `linkStrategyAgent`: erstellt Linkbuilding-Kampagnenstrategie als erstes Playbook.
- `prospectQualifierAgent`: scored/importiert Prospects je Kampagnentyp.
- `contactEnrichmentAgent`: crawlt Kontaktinfos.
- `outreachDraftAgent`: erstellt Sequenzen und Personalisierung.
- `sendingScheduler`: plant und versendet Mails.
- `inboxSyncWorker`: liest Antworten.
- `replyClassifierAgent`: klassifiziert und schlaegt Aktionen je Kampagnentyp vor.
- `warmupWorker`: fuehrt Warm-up aus.
- `mailboxHealthWorker`: prueft Auth, DNS, Limits, Bounces.
- `goalVerificationWorker`: prueft gewonnene Ziele.
- `linkVerificationWorker`: prueft gewonnene Links als erste Goal-Verifikation.
- `weeklyDigestWorker`: erstellt Wochenreport.

## MVP-Scope

Der erste baubare Scope sollte gross genug sein, um den Prozess zu beweisen, aber klein genug, um nicht in Infrastruktur zu versinken.

MVP 1 - Outreach Core mit Linkbuilding-Playbook:
- Kampagnen erstellen.
- Kampagnentyp `linkbuilding` speichern, aber Struktur fuer weitere Typen offen halten.
- Artikel/Assets zuordnen.
- Prospects manuell/CSV importieren.
- AI-Scoring und Tiering.
- Outreach-Sequenzen erstellen.
- Gmail OAuth fuer eine Mailbox.
- Queue mit Versandfenster, Tageslimit und randomisiertem Abstand.
- Reply-Erkennung fuer Gmail.
- AI-Reply-Klassifikation.
- Suppression/Blacklist.
- Manuelles Markieren von gewonnenen Links.
- Weekly Digest.

MVP 2 - Deliverability Layer:
- Mehrere Mailboxen pro Kampagne.
- Inbox Rotation.
- Mailbox Health Dashboard.
- SPF/DKIM/DMARC/MX Checks.
- Warm-up mit Seed-Inboxes.
- Adaptive Sending bei Bounce-/Auth-/Limit-Problemen.
- Goal Verification Crawler, zuerst fuer Link Placements.

MVP 3 - Discovery Layer:
- Eigener Web-Crawler fuer Resource Pages und Kontaktseiten.
- SERP-Collector oder austauschbare Search-Provider.
- Competitor backlink CSV normalization.
- Unlinked mention checks.
- Contact enrichment.

MVP 4 - Weitere Outreach-Playbooks:
- PR-Playbook mit Journalisten-/Redaktionslogik, Pitch-Typen und Presseerfolg.
- Sales-Playbook mit ICP, Pain Points, Call-/Opportunity-Zielen und CRM-light Status.
- Partnership-Playbook mit Kooperationszielen und Co-Marketing-Assets.

## Erste Build-Reihenfolge

1. Datenmodell fuer Kampagnen, Prospects, Contacts, Sequences, Messages, Mailboxes, Replies, Suppression, Placements.
2. UI fuer Campaign Intake und Prospect Import.
3. AI-Strategy und Prospect-Scoring Agent.
4. Sequence Editor mit Personalisierungsvariablen und Testmail.
5. Gmail OAuth und Mailbox-Tabelle.
6. Sending Queue fuer eine Mailbox mit Tageslimit, Zeitfenster, Random Delay und Reply-Stop.
7. Inbox Sync und Reply Classification.
8. Central Inbox und Action Queue.
9. Weekly Digest.
10. Inbox Rotation.
11. Warm-up Engine.
12. Mailbox Health und Adaptive Sending.
13. Goal Verification, zuerst Link Verification.
14. Discovery Automatisierung.

## UX-Prinzipien

- Kein Tool-Dschungel: ein Workspace fuer den ganzen Prozess.
- Erst Prozess, dann Rohdaten.
- Jede Kampagne hat einen klaren naechsten Schritt.
- Tabellen duerfen dicht sein, aber nicht chaotisch.
- Status und Risiken muessen sichtbar sein: Mailbox kaputt, Warm-up zu jung, Bounce-Spike, zu wenig positive Antworten.
- AI arbeitet als Operator, nicht als Blackbox: Score-Begruendung, Reply-Begruendung und vorgeschlagene Aktion anzeigen.

## Recht & Risiko

Das System soll nicht kuenstlich kastriert werden. Trotzdem brauchen wir operative Schutzfunktionen, weil sie Zustellbarkeit, Reputation und Prozessqualitaet verbessern:
- Suppression List.
- Unsubscribe/Blacklist Handling.
- Datenherkunftsantworten.
- Rate Limits.
- Bounce Stop.
- Domain-/Mailbox-Warnungen.
- Audit Trail.

Das ist keine Rechtsberatung, sondern Produkt- und Deliverability-Design.

## Offene Entscheidungen

- Gmail zuerst oder Gmail + Microsoft gleichzeitig?
- Warm-up nur mit kundeneigenen Seed-Inboxes oder auch mit eigenen Plattform-Seed-Inboxes?
- Soll der erste MVP tatsaechlich senden duerfen oder zuerst nur Drafts und manuelle Freigabe?
- Soll Link Verification schon in MVP 1 oder erst nach dem Versandlayer kommen?

## Empfehlung

Wir bauen das Outreach Operating System in zwei grossen Saeulen:

1. Outreach-Intelligenz: Strategy, prospects, scoring, personalization und zielbezogene Playbooks.
2. Eigene Outreach-Infrastruktur: mailboxes, warm-up, inbox rotation, sending scheduler, reply classification, weekly digest.

Der erste echte Produktdurchbruch ist nicht Auto-Prospecting. Der erste Durchbruch ist: Ein Nutzer kann aus einem Artikel eine Linkbuilding-Kampagne erstellen, Prospects importieren, die besten Chancen priorisieren, Sequenzen freigeben, sauber versenden, Antworten automatisch sortieren und jede Woche wissen, welche Links realistisch entstehen. Dieselbe Infrastruktur kann danach PR-, Sales-, Partnership- und Seeding-Kampagnen tragen.
