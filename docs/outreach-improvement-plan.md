# Outreach-Modul — Verbesserungsplan (Council-Synthese)

Stand: 2026-06-30 · Quelle: Code-Review-Council (Architect, Engineer, User-Advocate, Security, Devil's Advocate) + Overview-Map.
Modul von Codex gebaut. Ziel: Security + Billing härten, Bugs fixen, refaktorieren, ehrliche Produkt-Grenzen.

## P0 — Security + Billing (sofort, kritisch)

1. **Credit-Refund + Retry-Idempotenz (BILLING-BUG, echtes Geld).** `checkAndReserveCredits` (convex/agents/internal.ts:309) zieht balance sofort ab; `refundCredits` (internal.ts:362) wird NIE aufgerufen; `check-credits` ist erster `step.run` → Inngest `retries:2` bucht 2-3× ab. → Reserve idempotent pro `inngestEventId` (Flag im agentJob prüfen), `refundCredits` in jedem Fehlerpfad. Beide Inngest-Fns. **S-M**
2. **outreachStrategy try/catch + mark-failed.** outreachStrategy.ts:306-471 hat KEIN try/catch → Job bleibt „running"-Zombie, Credits verbrannt. → Body in try/catch wie outreachIntelligence, im catch agentJob='failed' + refund + rethrow. **S**
3. **Cross-Tenant-Exfiltration: Owner-Check in internalQueries fehlt.** getContext (outreachIntelligence.ts:108), getCampaignContext (outreachInternal.ts:64) laden Projekt/Brand/GSC/Kontakt nur per ID, kein ownerId-Abgleich. Write-Actions (saveStrategyOutput/saveCompleted/createGeneratedCampaign) ebenso. → ownerId/workspace-Scope als Pflicht-Arg durch die Action durchreichen + in internalQuery gegen workspace.ownerId prüfen (return null/throw). **M**
4. **Worker-Secret härten.** outreachActions.ts:6 / outreachIntelligenceActions.ts:8: `OUTREACH_WORKER_SECRET || INNGEST_EVENT_KEY`-Fallback + non-constant-time `!==`. → dediziertes Secret OHNE Fallback erzwingen + `crypto.timingSafeEqual` (Längen-Guard). Optional: Inngest-Request-Signatur. **S**
5. **bodycamPages-Tenant-Leak.** getContext (outreachIntelligence.ts:164) `ctx.db.query("bodycamPages").collect()` unscoped → fremde Projektdaten ins LLM-Prompt. → projektbezogen filtern oder entfernen (gehört nicht in Outreach-Kontext). **S**
6. **SSRF im Sitemap-Fetch.** discoverSitemap (outreachIntelligence.ts:390) fetcht user-kontrollierte domain/wpUrl ohne private/metadata-IP-Block. → vor jedem fetch (auch nach Redirect, `redirect:"manual"`) Hostname auflösen, 127.0.0.1/169.254.169.254/10./172.16./192.168./localhost blocken, nur http(s) + Port 80/443. **M**

## P1 — Bugs + Fehlerbehandlung

7. **Halluzinierte Kontakte als „found" gespeichert.** LLM erfindet domain/contactEmail/contactName (keine SERP/Verify-Quelle), createProspectsBatch schreibt als `contactStatus:"found"`. → LLM-E-Mails als `unverified` markieren (nicht „found"), im UI als „KI-Vorschlag, unverifiziert" kennzeichnen. (Produktentscheidung — siehe unten.) **S**
8. **jobId/inngestEventId-Divergenz in outreachStrategy** (`event.id || Date.now()` mehrfach neu berechnet, Z.327/349/435) → einmal oben berechnen, überall nutzen. **S**
9. **Qualitäts-Gate.** normalize* erzwingt immer ≥1 fallbackOpportunity → Garbage immer „ready". → wenn nur Fallback (0 echte LLM-Opportunities): Status „needs_review" statt „ready"; bei Fallback ggf. reduzierte/keine Credits. **S-M**
10. **updateGoal verifiedAt** bei Wechsel weg-von-verified explizit leeren (separater Patch, nicht via stripUndefined), damit Re-Verifizierung frischen Timestamp bekommt. **S**

## P2 — Refactoring + Architektur + Tests

11. **Kanonisches `requireProjectAccess`** (auth.ts:63) nutzen; 4 Kopien von `verifyProjectAccess` + `stripUndefined`-Dupes entfernen → `convex/lib/`. **M**
12. **Enum-Validierung.** campaignType/status/goalType/tier/method/rel/approvalStatus als `v.union(v.literal(...))` statt freier `v.string()`. **M**
13. **Tote `outreachAssets`-Tabelle** entfernen (nie geschrieben) + aus getCampaignBundle. **S**
14. **Pagination.** listCampaigns + getCampaignBundle (5× `.collect()`) → `paginate()`; latestByProject → Index `.order("desc").first()` statt collect+JS-sort. **M**
15. **test-Script + Verhaltenstests.** `"test"` in package.json (tsx --test/Vitest) + CI; 2/3 grep-over-source-Tests durch echte Unit-Tests (normalize*, dedup, credit-Logik) ersetzen. **M**

## P3 — UX + Produkt

16. **Strategie-Job-Status-Polling** auf OutreachCampaignDetail (wie IntelligencePanel) + Button disabled bis terminal. **M**
17. **Fehler-Toasts** bei handleProspectStatus/handleCreateGoal (+ Pflichtfeld-Validierung Ziel). **S**
18. **CSV-Import:** Spalten-Vorschau, Header-Erkennung, contactName lesen, ungültige Zeilen melden. **M**
19. **Leerer Strategie-Tab:** EmptyState mit „Strategie generieren"-CTA + Import-Hinweis. **S**
20. **URL/rel-Validierung** (Placement/Goal): URL-Format prüfen, rel als Select (dofollow/nofollow/sponsored). **S**

## Produkt-/Rechts-Entscheidungen (brauchen Klaus, NICHT still entscheiden)

- **Kein Versand-Pfad existiert.** Sequenzen werden erstellt/„freigegeben", aber nie gesendet (kein resend/smtp/sendgrid, keine outbox-Tabelle). Entscheidung: (a) ehrlich als „Strategie-/Sequenz-Generator" labeln (Versand extern), oder (b) Versand bauen (Modul-Erweiterung).
- **DSGVO/UWG:** Bei jedem künftigen Versand zwingend Rechtsgrundlage, Opt-out/Abmelde, Impressum, Suppression-Enforcement. Aktuell `suppressed` totes Feld. Kaltakquise-Mail in DE per §7 UWG kritisch.
- **DA-Scores/Tiers** sind LLM-Schätzungen (keine Ahrefs-Quelle). Als „KI-Schätzung" kennzeichnen oder echte API anbinden.
- **Halluzinierte Kontaktdaten:** vor Versand zwingend verifizieren.

## Entscheidungen (Klaus, 2026-06-30)
- **Ausführung in FOKUS-Session** (in headless-seo, `npx convex dev` + Inngest lokal, testbar vor Prod-Deploy) — nicht aus gesättigtem Kontext.
- **Versand-Pfad WIRD gebaut** (großes Modul). Damit zwingend mit-bauen: echter E-Mail-Versand (Resend/SMTP) + Scheduling/Outbox-Tabelle + Prospect-Status-Übergang „contacted" + **Suppression-Enforcement** + **Consent/Opt-out/Abmelde-Link + Impressum** + **Kontakt-Verifikation** (LLM-erfundene E-Mails NICHT als „found"/versandfähig, erst verifizieren). DE-Recht: §7 UWG/DSGVO Opt-in — Versand nur an rechtlich zulässige Empfänger; Rechtsgrundlage je Outreach-Typ vorab klären. DA-Scores als „KI-Schätzung" labeln bis echte API.

## Bereits erledigt (commit 01650e9)
- Constant-time worker-secret compare (`convex/lib/constantTimeEqual.ts`) — Timing-Leak gefixt; INNGEST_EVENT_KEY-Fallback noch drin (TODO P0-4: erst `OUTREACH_WORKER_SECRET` in Prod-Env setzen, dann Fallback raus).

## Ausführungs-Reihenfolge (Fokus-Session)
P0 (1-6, inkl. Billing-Refund-Idempotenz via onFailure, Owner-Checks, Fallback-Entfernung nach Env-Setup, SSRF, bodycam-Scope) → `convex dev`/Inngest-Test → Commit · P1 (7-10) → Test → Commit · P2 (11-15) → Test → Commit · P3 (16-20) → Test → Commit · dann **Modul 1b Versand-Pfad** (Outbox+Send+Suppression+Consent+Verifikation) · dann **Modul 2 (Social)** · 2. Council-Loop über den finalen Code · Modul-2-Test · Report.
