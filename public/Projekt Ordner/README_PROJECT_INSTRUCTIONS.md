# PROJECT INSTRUCTIONS - Übersicht & Verwendung

## 📁 Erstellte Dokumente

### 1. JSON Generation Instructions (HAUPTDOKUMENT)
**Für das Claude Project Instructions Feld:**

- **`PROJECT_INSTRUCTIONS_JSON_COMPACT.txt`** ⭐ 
  - **Kompakte Version für das Instructions-Feld** (siehe Screenshot)
  - Essenzielle Infos: Workflow, Pflichtfelder, Markenfarben, Output-Format
  - ~400 Zeilen, optimiert für schnelles Laden

- **`PROJECT_INSTRUCTIONS_JSON_GENERATION.md`**
  - Vollständige Referenz für komplexe Fälle
  - Detaillierte Erklärungen, Beispiele, Checklisten
  - ~250 Zeilen, als Backup/Nachschlagewerk

### 2. Markenspezifische Content-Referenzen

Diese Dokumente dienen als **Kontext für den Content im JSON**, nicht für die JSON-Struktur selbst:

- **`PROJECT_INSTRUCTIONS_MICROVISTA.docx`** (15KB)
  - Brand Voice, Tonalität, Personas für Microvista GmbH
  - Wissenschaftlich, technisch präzise, keine Frameworks
  - Farben: #8ebfd6, #32285b, #ee7711

- **`PROJECT_INSTRUCTIONS_NETCO_BAUSTELLENKAMERA.docx`**
  - Brand Voice, Frameworks (SQME/PPPP/QUEST), Personas (Thomas & Sandra)
  - Praxisnah, lösungsorientiert
  - Farben: #ff6600, #003366, #ff8533

- **`PROJECT_INSTRUCTIONS_NETCO_BODY_CAM.docx`** (in Bearbeitung)
  - Brand Voice, 3-Stufen-Policy, Deeskalation, Personas (Michael/Sandra/Thomas)
  - Klar, sicher, innovativ
  - Farben: #1a365d, #ff6b35

---

## 🎯 Verwendung im Claude Project

### Schritt 1: Instructions-Feld befüllen
Kopiere den Inhalt von **`PROJECT_INSTRUCTIONS_JSON_COMPACT.txt`** in das "Instructions"-Feld (siehe Screenshot oben rechts im Projekt).

### Schritt 2: Dokumente hochladen
Stelle sicher, dass folgende Dokumente im Projekt verfügbar sind:

**Pflicht (JSON-Struktur):**
- ✅ `Elementor_JSON_Widget_Templates.docx` (2.640 Zeilen)
- ✅ `Elementor_JSON_Checkliste.docx` (44 Zeilen)

**Marken-Kontext (Content):**
- ✅ `Microvista_GmbH_-_Brand_Voice_Guide.docx`
- ✅ `NetCo_Baustellenkamera_Brand_Voice_Guide.docx`
- ✅ `NetCo_Body_Cam_Brand_Voice_Guide.docx`
- ✅ `Brandguide_Microvista_GmbH.pdf`
- ✅ `Brand_Guide_BK_08_2025__.pdf`
- ✅ `Brandguide_Body-Cam.docx`

**Beispiele (optional):**
- `elementor-*.json` (Referenz-Templates)

### Schritt 3: Workflow im Chat
```
User: [SEO-Text einfügen]

Claude: 
1. Analysiert die Struktur
2. Identifiziert die Marke
3. Lädt Brand Voice Kontext (view-Funktion)
4. Referenziert Widget Templates
5. Generiert validen JSON
6. Validiert mit Checkliste
7. Gibt NUR JSON-Code aus
```

---

## 📊 Was macht welches Dokument?

| Dokument | Zweck | Verwendet für |
|----------|-------|---------------|
| `PROJECT_INSTRUCTIONS_JSON_COMPACT.txt` | **Hauptsteuerung** | Instructions-Feld im Projekt |
| `Elementor_JSON_Widget_Templates.docx` | JSON-Struktur | Sections, Columns, Widgets |
| `Elementor_JSON_Checkliste.docx` | Validierung | Pflichtfelder prüfen |
| `*_Brand_Voice_Guide.docx` | Content-Tonalität | Headlines, Text, CTAs formulieren |
| `Brandguide_*.pdf` | Visuelle Identität | Farben, Typografie im JSON |
| `PROJECT_INSTRUCTIONS_MICROVISTA.docx` | Detaillierte Referenz | Fallback bei Unklarheiten |

---

## ✅ Erfolg überprüfen

Der JSON-Code ist erfolgreich, wenn:

1. ✅ **Valide Syntax:** Keine JSON-Fehler beim Upload
2. ✅ **Korrekte Struktur:** Sections → Columns → Widgets
3. ✅ **Markenfarben:** Hex-Codes stimmen mit Brand Guide überein
4. ✅ **Responsive:** Mobile-Varianten vorhanden
5. ✅ **Pflichtfelder:** Alle Checklisten-Punkte erfüllt
6. ✅ **Kein Zusatztext:** Nur JSON-Code, keine Erklärungen

---

## 🚀 Zeitersparnis

**Vorher:** 1 Tag manuelles Elementor-Layout erstellen  
**Nachher:** 5-10 Minuten SEO-Text → JSON → Upload  
**Ersparnis:** ~90% Zeit ⚡

---

## 🔄 Updates

Bei Änderungen an:
- **Widget-Templates:** `Elementor_JSON_Widget_Templates.docx` aktualisieren
- **Markenfarben:** Brand Guides aktualisieren
- **Neue Widgets:** Templates-Dokument erweitern, Checkliste anpassen
- **Instructions:** `PROJECT_INSTRUCTIONS_JSON_COMPACT.txt` anpassen

---

**Version:** 1.0  
**Stand:** November 2025  
**Projekt:** NDT JSON to ELEMENTOR
