# LEARNINGS: Elementor JSON-Generierung

**Projekt:** Microvista Wanddickenmessung Landing Page  
**Datum:** 04. November 2025  
**Status:** ✅ Erfolgreich gelöst

---

## 🎯 KRITISCHE ERKENNTNISSE

### 1. **ACCORDION WIDGET - TABS vs. ACCORDION ARRAY**

**Problem:**  
Elementor Accordion Widgets haben ZWEI Daten-Arrays:
- `accordion` Array (die eigentlichen Accordion-Daten)
- `tabs` Array (wird ZUERST gerendert!)

**❌ Fehler:**
```json
{
  "accordion": [echte FAQ-Daten],
  "tabs": [
    {"tab_title": "Akkordeon Nr. 1", "tab_content": "Lorem ipsum..."},
    {"tab_title": "Akkordeon #2", "tab_content": "Lorem ipsum..."}
  ]
}
```
→ Elementor zeigt die Dummy-Tabs an, nicht die echten Accordion-Daten!

**✅ Lösung:**
```json
{
  "accordion": [echte FAQ-Daten],
  "tabs": [
    {"_id": "faq001", "tab_title": "Echte Frage 1", "tab_content": "<p>Echte Antwort</p>"},
    {"_id": "faq002", "tab_title": "Echte Frage 2", "tab_content": "<p>Echte Antwort</p>"}
  ]
}
```

**REGEL:**  
Bei Accordion Widgets MÜSSEN beide Arrays (`accordion` UND `tabs`) die **gleichen Daten** enthalten!

**Code-Snippet für korrekte Konvertierung:**
```python
accordion_items = settings['accordion']
new_tabs = []
for item in accordion_items:
    new_tabs.append({
        '_id': item['_id'],
        'tab_title': item['accordion_title'],
        'tab_content': item['accordion_content']
    })
settings['tabs'] = new_tabs
```

---

### 2. **KACHEL-ABSTÄNDE (Feature Cards)**

**Problem:**  
`gap: "wide"` allein vergrößert die Abstände NICHT sichtbar.

**✅ Lösung:**
Zusätzlich `column_gap` explizit setzen:
```json
{
  "gap": "wide",
  "column_gap": {"unit": "px", "size": 30, "sizes": []},
  "column_gap_mobile": {"unit": "px", "size": 20, "sizes": []}
}
```

**Empfohlene Werte:**
- Desktop: 30px
- Mobile: 20px

---

### 3. **GRADIENT SECTIONS - TEXT-KONTRAST**

**Problem:**  
Gradient-Hintergründe wurden erstellt, aber Texte blieben dunkel → schlechter Kontrast.

**✅ Regel:**
Bei Gradient-Hintergründen (dunkel) **IMMER** Textfarben anpassen:

```python
if background_type == "gradient" and is_dark_gradient:
    # H2 Überschriften
    widget["settings"]["title_color"] = "#ffffff"
    
    # H3 Überschriften
    if widget["settings"]["header_size"] == "h3":
        widget["settings"]["title_color"] = "#ee7711"  # Orange für Akzente
    
    # Body Text
    widget["settings"]["text_color"] = "#ffffff"
```

**Best Practice:**
Nur 2-3 Gradient-Sections pro Seite verwenden (Hero, CTA, optional 1 weitere für Highlights).

---

### 4. **VISUELLE ABWECHSLUNG**

**Gelernt:**  
Monotone Hintergründe (nur weiß oder grau) wirken langweilig.

**✅ Empfohlenes Pattern:**
```
Section 1:  Gradient (Hero) - #32285b → #8ebfd6
Section 2:  Weiß #ffffff
Section 3:  Hellgrau #f8f9fa
Section 4:  Hellgrau #f8f9fa (Kacheln)
Section 5:  Weiß #ffffff
Section 6:  Hellgrau #f8f9fa
Section 7:  Weiß #ffffff
Section 8:  Weiß #ffffff
Section 9:  Hellgrau #f8f9fa
Section 10: Weiß #ffffff
Section 11: Gradient (CTA) - #32285b → #8ebfd6
Section 12: Hellgrau #f8f9fa (FAQ)
```

**Regel:**
- Max. 2-3 Gradients pro Seite
- Abwechselnd weiß/grau für Rest
- Keine 3+ aufeinanderfolgenden gleichen Farben

---

### 5. **BOX/CARD ABSTÄNDE**

**User-Feedback:**  
Manuelle Anpassungen in Elementor haben besser funktioniert als JSON-Settings.

**Empfehlung für Cards:**
```json
{
  "background_background": "classic",
  "background_color": "#ffffff",
  "padding": {"unit": "px", "top": "40", "right": "35", "bottom": "40", "left": "35", "isLinked": false},
  "_margin": {"unit": "px", "top": "20", "right": "20", "bottom": "20", "left": "20", "isLinked": false},
  "border_radius": {"unit": "px", "top": "12", "right": "12", "bottom": "12", "left": "12", "isLinked": true},
  "box_shadow_box_shadow_type": "yes",
  "box_shadow_box_shadow": {"horizontal": 0, "vertical": 10, "blur": 30, "spread": 0, "color": "rgba(0,0,0,0.06)"}
}
```

**User bevorzugt:**  
`_margin: 20px` in alle Richtungen für Cards.

---

## 🔧 TECHNISCHE BEST PRACTICES

### ID-Konventionen
```
✅ Gut: "hero0001", "colh0001", "headh001"
❌ Schlecht: "Hero0001", "col_h_0001"
```

**Regel:**
- 7-8 Zeichen
- Lowercase
- Nur Buchstaben + Zahlen
- Keine Unterstriche, Bindestriche, Großbuchstaben

---

### Farben - HEX mit #-Prefix
```
✅ "#32285b"
❌ "32285b"
```

---

### Padding/Margin - isLinked Property
```json
// Wenn ALLE Seiten gleich:
{"unit": "px", "top": "30", "right": "30", "bottom": "30", "left": "30", "isLinked": true}

// Wenn unterschiedlich:
{"unit": "px", "top": "90", "right": "20", "bottom": "90", "left": "20", "isLinked": false}
```

---

### Font Sizes - Responsive
```json
{
  "typography_font_size": {"unit": "px", "size": 38, "sizes": []},
  "typography_font_size_mobile": {"unit": "px", "size": 28, "sizes": []}
}
```

**Empfohlene Ratios:**
- H1: 52px → 34px (ca. 65%)
- H2: 38px → 28px (ca. 74%)
- H3: 28px → 22px (ca. 79%)
- Body: 18px → 16px (ca. 89%)

---

## ⚠️ HÄUFIGE FEHLER

### 1. Fehlende _column_size
```json
❌ {"id": "col001", "settings": {}}
✅ {"id": "col001", "settings": {"_column_size": 100, "_inline_size": null}}
```

### 2. Fehlende widgetType
```json
❌ {"id": "widget01", "elType": "widget", "settings": {...}}
✅ {"id": "widget01", "widgetType": "heading", "elType": "widget", "settings": {...}}
```

### 3. Fehlende isInner Property
```json
✅ Alle Sections: "isInner": false
✅ Inner Sections (für 2-Spalten Layout): "isInner": true
✅ Alle Widgets: "isInner": false
```

### 4. Gradient ohne Angle
```json
❌ "background_gradient_type": "linear"
✅ "background_gradient_type": "linear",
   "background_gradient_angle": {"unit": "deg", "size": 135}
```

---

## 📋 WORKFLOW FÜR NEUE LANDING PAGES

1. **Struktur analysieren** (H1/H2/H3, Listen, CTAs, FAQs)
2. **Marke identifizieren** → Farben + Fonts aus Brandguide
3. **Widget Templates laden** (docx/SKILL.md)
4. **JSON generieren:**
   - Hero (Gradient)
   - Intro (Text + Alert Box)
   - Benefits Header
   - Feature Cards (3 Spalten, column_gap: 30px)
   - Content Sections (abwechselnd weiß/grau)
   - CTA (Gradient mit Icon-List)
   - **FAQ (accordion + tabs beide befüllen!)**
5. **Validierung mit Checkliste**
6. **Test-Import in Elementor**

---

## 🎨 MICROVISTA MARKEN-SPEZIFIKA

### Farben
```
Primary:   #32285b (Dunkelblau)
Secondary: #8ebfd6 (Hellblau)
Accent:    #ee7711 (Orange)
```

### Typografie
```
Headlines: Antonio Bold
Body:      PT Sans
```

### Gradient-Winkel
```
Standard: 135deg (diagonal von links-oben nach rechts-unten)
```

### Button-Stil
```json
{
  "border_radius": {"unit": "px", "top": "50", "right": "50", "bottom": "50", "left": "50", "isLinked": true},
  "button_padding": {"unit": "px", "top": "18", "right": "35", "bottom": "18", "left": "35", "isLinked": false},
  "box_shadow_box_shadow_type": "yes",
  "box_shadow_box_shadow": {"horizontal": 0, "vertical": 8, "blur": 20, "spread": 0, "color": "rgba(238,119,17,0.4)"}
}
```

---

## 🚀 NEXT STEPS FÜR ZUKÜNFTIGE PROJEKTE

1. **Template Library erweitern:**
   - Mehr vorgefertigte Section-Varianten
   - Testimonial Sections
   - Pricing Tables
   - Timeline/Process Sections

2. **Automatisierung:**
   - Script für automatische accordion ↔ tabs Synchronisation
   - Gradient-Kontrast-Check (auto-adjust text colors)
   - Responsive-Ratio Calculator

3. **Checkliste erweitern:**
   - Accordion/Tabs Sync Check
   - Kontrast-Check für alle Text/Background Kombinationen
   - column_gap für alle Multi-Column Sections

---

## ✅ ERFOLGSKRITERIEN

Eine Landing Page ist fertig wenn:

- [ ] Alle IDs sind 7-8 Zeichen, lowercase
- [ ] Alle Farben haben # Prefix
- [ ] Alle Columns haben _column_size
- [ ] Alle Widgets haben widgetType
- [ ] FAQ Accordion: tabs + accordion Arrays identisch
- [ ] Multi-Column Sections: column_gap explizit gesetzt
- [ ] Gradient Sections: Textfarben auf weiß/hell
- [ ] Responsive: Mobile Font-Sizes definiert
- [ ] JSON validiert (python -m json.tool)
- [ ] Visuelle Abwechslung: 2-3 Gradients, Rest abwechselnd

---

**Version:** 1.0  
**Letztes Update:** 04.11.2025  
**Autor:** Claude (Anthropic)
