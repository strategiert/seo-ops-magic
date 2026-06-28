# Redaktioneller Ressourcen-Planer Design

## Ziel

Der Outreach-Bereich braucht einen Zwischenschritt zwischen Projektanalyse und Outreach-Kampagne: Die KI soll nicht nur vorhandene Inhalte bewerten, sondern eine redaktionell verlinkbare Ressource planen. Intern kann das weiter als Linkbait verstanden werden. In UI, Output und Outreach wird der Begriff nicht verwendet. Extern sprechen wir von `Ressource`, `Ratgeber`, `Checkliste`, `Tool`, `Broschüre`, `PDF`, `Studie`, `Hilfsmittel` oder `weiterführender Information`.

Das Ergebnis soll beantworten:

- Was sollten wir für dieses Projekt bauen?
- Für welche Linkzielgruppen ist es nützlich?
- Warum würde ein Webmaster, Redakteur, Verein, Pädagoge oder Fachblog es freiwillig empfehlen?
- Wie muss die Ressource entkommerzialisiert werden, damit sie nicht nach Sales-Funnel wirkt?
- Was muss Claude Code später bauen oder ausarbeiten?
- Welche Argumente braucht der spätere Outreach-Pitch?

## Produktpositionierung

Der Planer ist kein LinkedIn-Post-Generator und kein reiner CRM-Schritt. Er ist ein `editorial value engineering` Tool: Aus Projektwissen, Website-Content und Sitemap entsteht ein Linkobjekt, das eine fremde Seite für deren Leser besser macht.

Die zentrale Denklogik:

1. Linkerati sind nicht zwingend Kunden.
2. Linkgeber brauchen einen guten Grund, eine externe Ressource zu empfehlen.
3. DACH-Linkaufbau belohnt Tiefe, Seriosität und echten Nutzen stärker als oberflächliche Infografiken oder Gewinnspiele.
4. Die Ressource braucht eine entkommerzialisierte Zone: keine Salesbotschaft, kein Warenkorb, keine aggressive Lead-Mechanik.
5. Outreach funktioniert besser, wenn die Anfrage eine konkrete Stelle auf einer fremden Seite sinnvoll ergänzt.

## Nutzererlebnis

Der Outreach-Screen bekommt nach der KI-Analyse einen neuen Abschnitt `Ressourcen-Planer`.

Der normale Ablauf:

1. Nutzer klickt `KI analysieren`.
2. Outreach Intelligence sammelt Projekt-, Brand-, Crawl-, Content- und Sitemap-Daten.
3. Der Ressourcen-Planer erzeugt mehrere Ressourcen-Ideen und bewertet sie in einer Matrix.
4. Nutzer öffnet eine Idee.
5. Die Detailansicht zeigt das Ressourcen-Konzept, die Linkzielgruppen, die Entkommerzialisierungsregeln, den Claude-Code-Build-Brief und Outreach-Rohmaterial.
6. Nutzer kann daraus später eine Kampagne, einen Build-Auftrag oder eine Content-Aufgabe ableiten.

Die UI darf den strategischen Hintergrund zeigen, aber nicht akademisch wirken. Der Nutzer soll in wenigen Minuten sehen, welche Ressource sich lohnt und warum.

## Ressourcenformat-Taxonomie

Die KI stellt nicht offen nur die Frage `Welche Ressource sollten wir bauen?`, sondern wählt ein Hauptformat und zwei Alternativen aus einer festen Taxonomie.

Formate:

- Ratgeber / Broschüre
- Checkliste
- Kommentierte Linkliste
- Ressourcenliste
- Ranking / Award
- Vergleichstest
- Testbericht / Review
- Erfahrungsbericht
- Pro-und-Kontra-Übersicht
- Anleitung / Schritt-für-Schritt-Guide
- FAQ
- Lexikon / Glossar
- Experteninterview
- Gruppeninterview / Expert Roundup
- Analyse / Umfrage
- Report / Whitepaper
- Studie / Datenauswertung
- Kostenloses Tool
- Rechner / Kalkulator
- Widget / Plugin / Datenbank
- Interaktive Grafik / Diagramm
- Timeline / Karte / Visualisierung
- PDF zum Ausdrucken
- Notfallkarte / Spickzettel
- Comic / visuelle Erklärung
- Journalisten-Seite / Presse-Ressource
- News / bemerkenswerte Meldung
- anderes Format

Jede Idee bekommt eine Bewertungsmatrix:

- Leser-Nutzen
- Redaktions-Nutzen
- Linkgrund
- Glaubwürdigkeit
- Aufwand
- Evergreen-Faktor
- DACH-Tauglichkeit
- Outreach-Fit
- Entkommerzialisierungsbedarf
- Gesamtscore

## Kernfragen des Planers

Der Planer beantwortet pro Ressourcen-Idee diese Fragen:

1. Welche Ressource sollten wir bauen?
2. Welche Hauptzielgruppe hat diese Ressource als Leser?
3. Welche Linkzielgruppen könnten sie empfehlen oder verlinken?
4. Welche Aufgabe, Agenda oder redaktionelle Pflicht hat diese Linkzielgruppe?
5. Welches konkrete Leserproblem löst die Ressource?
6. Warum verbessert sie einen bestehenden fremden Artikel oder eine Ressourcenseite?
7. Welches Format ist am stärksten und welche zwei Alternativen wären plausibel?
8. Welche Belege, Quellen, Experten oder Daten erhöhen die Glaubwürdigkeit?
9. Welche kommerziellen Elemente müssen entfernt oder abgeschwächt werden?
10. Welche konkrete Outreach-Begründung ist fair und nicht spammy?
11. Welche Suchoperatoren helfen, passende Linkquellen zu finden?
12. Was muss als MVP gebaut werden, damit der Pitch glaubwürdig ist?

## Datenquellen

Der Planer nutzt die Daten aus der bestehenden Outreach Intelligence:

- `projects`: Domain, Sprache, Land, Zielgruppe, WordPress-URL.
- `brandProfiles`: Marke, Angebote, Personas, Wettbewerber, Content-Gaps, Tonalität.
- `brandCrawlData`: gecrawlte Seiten, Markdown, Seitentypen, Titel, Überschriften, Links.
- `articles`: vorhandene Pillar-Artikel und Entwürfe.
- `contentBriefs`: geplante Inhalte, Keywords, Suchintention, NeuronWriter-Kontext.
- `htmlExports`: vorhandene Landingpages oder eigenständige HTML-Ressourcen.
- `contentAssets`: bestehende Social-, PR-, Newsletter- oder Linkbait-Assets.
- `gscConnections`: ob Search Console verfügbar ist.
- Sitemap-Discovery: URL-Struktur und offensichtliche Lücken.

Später kann der Planer SERP-, Backlink- und Wettbewerbsdaten ergänzen. Für den ersten Build reicht vorhandener Projektkontext plus Sitemap.

## AI Output

Die KI erzeugt strukturierte Ressourcen-Pläne. Pro Plan:

```json
{
  "title": "Eltern-Notfallkarte für Wutanfälle",
  "publicName": "Eltern-Notfallkarte",
  "resourceType": "Notfallkarte / Spickzettel",
  "alternativeTypes": ["Ratgeber / Broschüre", "PDF zum Ausdrucken"],
  "readerAudience": "Eltern von Kindern im Kita- und Grundschulalter",
  "linkAudiences": ["Elternportale", "Pädagogik-Websites", "Kitas", "Familienberatungen"],
  "readerProblem": "Eltern wissen in Eskalationsmomenten nicht, was sie sagen sollen.",
  "editorialValue": "Ergänzt bestehende Artikel über Wutanfälle um ein direkt nutzbares Hilfsmittel.",
  "linkReason": "Kostenlose, praktische Weiterführung für Leser, die nach konkreten Formulierungen suchen.",
  "decommercialization": ["Keine Produktwerbung", "Kein aggressives Leadgate", "Fachliche Quellen sichtbar machen"],
  "credibilityPlan": ["Quellen zu Co-Regulation", "Expertenzitat oder pädagogischer Review", "Klare Grenzen ohne Heilversprechen"],
  "formatScore": {
    "readerBenefit": 0.92,
    "editorialBenefit": 0.86,
    "linkReason": 0.88,
    "credibility": 0.72,
    "effort": 0.34,
    "evergreen": 0.91,
    "dachFit": 0.88,
    "outreachFit": 0.84,
    "total": 0.85
  },
  "mvpScope": ["Ratgeberseite", "druckbares PDF", "5 konkrete Sätze", "Mini-Routine", "Quellenbox"],
  "claudeCodeBrief": "Baue eine entkommerzialisierte Ressourcen-Seite...",
  "outreachRawMaterial": {
    "whyThisSite": "Die Zielseite behandelt bereits Wutanfälle bei Kindern.",
    "placementIdea": "Als weiterführende Information im Abschnitt zu akuten Situationen.",
    "pitchAngle": "kostenlose Notfallkarte als praktische Ergänzung für Eltern",
    "searchOperators": ["Wutanfall Kind Eltern Tipps", "site:.de Wutanfälle Kinder Eltern Ratgeber"]
  }
}
```

## Persistenz

Für den MVP kann der Ressourcen-Plan im bestehenden `outreachAnalyses.opportunitiesJson` gespeichert werden, wenn die Datenstruktur erweitert wird. Das ist schnell und passt zum aktuellen Flow.

Für die dauerhafte Produktversion ist eine eigene Tabelle besser:

- `resourcePlans`
- `projectId`
- `analysisId`
- `status`: `draft | selected | archived | converted_to_campaign | converted_to_build_brief`
- `title`
- `publicName`
- `resourceType`
- `score`
- `planJson`
- `claudeCodeBrief`
- `outreachRawMaterialJson`
- `createdCampaignId`
- `createdAt`, `updatedAt`

Empfehlung: Im ersten Implementierungsschnitt `opportunitiesJson` erweitern, aber die Struktur so gestalten, dass sie später ohne Bedeutungsverlust nach `resourcePlans` migriert werden kann.

## Komponenten

- `OutreachIntelligencePanel`: zeigt künftig Ressourcen-Ideen stärker als Kampagnen-Ideen.
- `ResourcePlanCard`: kompakte Karte mit Format, Score, Linkzielgruppen, Nutzen und Aufwand.
- `ResourcePlanDetail`: Detailansicht oder Dialog mit Konzept, Matrix, Entkommerzialisierung, Build-Brief und Outreach-Rohmaterial.
- `CopyBriefButton`: kopiert den Claude-Code-Build-Brief.
- `CopyOutreachMaterialButton`: kopiert die redaktionelle Begründung oder Pitch-Bausteine.

Die Detailansicht soll nicht wie ein CRM-Formular wirken, sondern wie ein strategisches Arbeitsdokument, das sofort verwendbar ist.

## Agent Flow

Der bestehende `outreach-intelligence` Agent wird erweitert:

1. Projektkontext laden.
2. Sitemap und vorhandenen Content analysieren.
3. Linkzielgruppen ableiten.
4. Ressourcenformate aus der Taxonomie bewerten.
5. Drei bis fünf Ressourcen-Pläne erzeugen.
6. Pro Plan Build-Brief und Outreach-Rohmaterial ausgeben.
7. Weiterhin optional eine Kampagne aus der stärksten Idee anlegen.

Die KI soll mindestens zwei `new_asset` Ideen erzeugen, auch wenn vorhandener Content schwach ist. Sie soll vorhandene Inhalte als Ausgangspunkt nutzen, darf aber neue Ressourcen vorschlagen, wenn diese für Linkgeber plausibler sind.

## Prompt-Prinzipien

Der Systemprompt muss diese Regeln enthalten:

- Denke zuerst aus Sicht fremder Leser und Redaktionen.
- Baue kein Angebot für Käufer, sondern eine Ressource für Linkgeber.
- Prüfe, ob das Format in DACH glaubwürdig und nützlich genug ist.
- Vermeide Sales-Sprache in öffentlichen Namen und Pitches.
- Nenne die Ressource nicht Linkbait.
- Gib konkrete Platzierungsideen auf fremden Seiten an.
- Priorisiere Tiefe, Quellen, Experten, praktische Anwendbarkeit und Evergreen-Wert.
- Wenn bestehender Content nicht stark genug ist, plane eine neue Ressource.

## Error Handling

- Wenn zu wenig Projektdaten vorhanden sind, erzeugt die KI trotzdem generische, aber klar markierte Ressourcen-Ideen mit niedriger Confidence.
- Wenn keine glaubwürdige Ressource gefunden wird, soll sie erklären, welche Daten oder Expertise fehlen.
- Wenn Sitemap-Fetching scheitert, wird mit Crawl-, Brand- und Content-Daten weitergearbeitet.
- Wenn ein Claude-Code-Brief nicht erzeugt werden kann, bleibt das Ressourcen-Konzept erhalten und zeigt den fehlenden Brief als Fehlerzustand.

## Testing

Tests sollen die Struktur und Normalisierung absichern:

- Tool-Output mit erweiterten Ressourcen-Plänen wird aus Anthropic Tool-Use korrekt gelesen.
- Fehlende optionale Felder werden sinnvoll normalisiert.
- Mindestens ein Plan kann `sourceKind: "new_asset"` sein.
- Öffentliche Labels enthalten nicht `Linkbait`.
- Umlaute bleiben korrekt.
- Die Format-Taxonomie enthält die Seminar-Formate wie Ratgeber, Broschüre, Checkliste, Vergleichstest, Experteninterview, Gruppeninterview, Analyse, Umfrage, Whitepaper, Tool, Rechner und Journalisten-Seite.

UI-Tests können später ergänzt werden. Für den ersten Schnitt reichen Skript-Tests plus Build-Verifikation.

## Nicht In Diesem Schnitt

- Automatisches Bauen der Ressource.
- Automatisches Veröffentlichen in WordPress.
- E-Mail-Versand.
- Warm-up.
- Prospect-Scraping in großem Umfang.
- Backlink-Datenbanken.
- Vollständige SERP-Analyse.
- Rechtliche Bewertung.

## Entscheidung Für Den Ersten Schnitt

Der erste Build startet in der bestehenden Outreach-Seite. Ein eigener Hauptnavigationspunkt `Ressourcen` wird erst relevant, wenn aus Plänen echte Assets mit Status, Versionen und Veröffentlichungsworkflow entstehen.
