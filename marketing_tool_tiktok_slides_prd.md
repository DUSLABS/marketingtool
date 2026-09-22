# Marketing Tool – TikTok Slides Campaign Builder

## 1. Produktvision

Das Marketing Tool soll ein **AI-first Content Operating System** für organisches Social-Media-Marketing werden.

Das erste Modul fokussiert sich auf **TikTok Photo/Slide Posts**. Nutzer laden Bildmaterial einmalig in thematische Alben hoch, definieren Kampagne, Thema und Ziel – das Tool erzeugt daraus automatisch viele unterschiedliche TikTok-Posts mit wechselnden Bildern, Hooks, Content-Texten und CTAs.

Ziel ist nicht, nur einen einzelnen Post zu bauen, sondern innerhalb weniger Minuten **eine komplette Testmatrix aus vielen Content-Varianten** zu generieren, zu veröffentlichen und später anhand der Performance zu optimieren.

Das Tool soll insbesondere für App-Marketing, SaaS, E-Commerce, Creator und kleine Marketing-Teams funktionieren.

---

## 2. Kernprinzip

Ein Post besteht aus drei möglichen Slide-Typen:

1. **Hook Slide** – Aufmerksamkeit gewinnen
2. **Content Slides** – Story, Informationen, Argumentation oder Mehrwert vermitteln
3. **CTA Slide** – Nutzer zu einer Handlung bewegen

Jeder dieser Bereiche kann mit einem eigenen Bildalbum verknüpft werden.

Beispiel:

```text
Hook Album
├── Hook Image 01
├── Hook Image 02
├── Hook Image 03
└── Hook Image 04

Content Album
├── Content Image 01
├── Content Image 02
├── Content Image 03
├── Content Image 04
├── Content Image 05
└── Content Image 06

CTA Album
├── CTA Image 01
├── CTA Image 02
└── CTA Image 03
```

Bei jeder Post-Variante wählt das System automatisch andere Bilder aus den zugeordneten Alben aus.

Dadurch können mit denselben Assets viele unterschiedliche Posts erzeugt werden.

---

# 3. Hauptfunktionen

## 3.1 Kampagnen

Nutzer können beliebig viele Kampagnen erstellen.

Beispiele:

- SameRoll – Wedding
- SameRoll – Birthday
- SameRoll – Party
- App Launch Germany
- Creator Campaign

Jede Kampagne besitzt eigene:

- Einstellungen
- Bildalben
- Hook-Varianten
- Content-Vorgaben
- CTA-Varianten
- TikTok Accounts
- Posting-Zeiten
- Performance-Daten
- generierte Posts

### Kampagnenübersicht

Die Campaign Library zeigt beispielsweise:

| Kampagne | Status | Posts | Geplant | Veröffentlicht | Avg. Views |
|---|---|---:|---:|---:|---:|
| SameRoll Wedding | Active | 42 | 18 | 24 | 4.820 |
| SameRoll Party | Draft | 16 | 0 | 0 | – |
| SameRoll Birthday | Active | 28 | 9 | 19 | 3.140 |

Mögliche Kampagnenstatus:

- Draft
- Active
- Paused
- Completed

---

# 4. Campaign Builder

Der Campaign Builder ist das Herzstück des Produktes.

Die Oberfläche besteht aus:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Campaign Name                         Preview      Generate      │
├─────────────────────────────────────────────────────────────────┤
│ [1 Hook] [2 Content] [3 Content] [4 Content] [5 CTA]           │
├──────────────────────────────────────────────┬──────────────────┤
│ Editor                                       │ Settings         │
│                                              │                  │
│ Hook / Content / CTA                         │ TikTok Account   │
│ Images                                       │ Posting Times    │
│ Text                                         │ Variations       │
│ AI Generation                                │ Schedule         │
│                                              │                  │
└──────────────────────────────────────────────┴──────────────────┘
```

Die Slides werden oben horizontal dargestellt.

Jede Slide zeigt:

- Nummer
- Typ
- Bild
- Text
- verwendetes Album
- Status

Die Slides können per Drag & Drop umsortiert werden.

---

# 5. Slide-Struktur

## 5.1 Hook Slide

Die Hook Slide ist optional, standardmäßig aber aktiviert.

Der Nutzer kann mehrere Hook-Texte hinterlegen.

Beispiele:

```text
POV: Your wedding guests actually send you the photos.

Nobody tells you this about wedding photos...

The easiest way to collect every photo from your wedding.

Your photographer won't capture these moments.
```

### Hook Modi

Der Nutzer kann Hooks auf drei Arten erstellen:

#### Manuell

Eigene Hook eingeben.

#### AI Generate

Thema eingeben und mehrere Hooks erzeugen lassen.

Beispiel:

```text
Topic:
Wedding photo sharing app

Generate:
20 Hook Variations
```

#### AI Rewrite

Bestehende Hook auswählen und Varianten erzeugen.

```text
Original:
Your photographer won't capture these moments.

Variants:
- These are the wedding photos your photographer never sees.
- Your photographer can't be everywhere.
- The best wedding photos usually aren't taken by the photographer.
```

### Hook Selection

Mehrere Hooks können aktiviert werden.

Bei der Generierung erstellt das Tool automatisch Posts mit unterschiedlichen Hook-Kombinationen.

---

# 6. Content Slides

Der Nutzer definiert die gewünschte Anzahl der Content Slides.

Beispiel:

```text
Content Slides: 5
```

Danach gibt er nur das Thema bzw. den gewünschten Inhalt vor.

Beispiel:

```text
Explain why guests take some of the best and most authentic wedding photos and how SameRoll collects all of them in one shared roll.
```

Die AI zerlegt den Inhalt automatisch auf die gewünschte Anzahl an Slides.

Beispiel:

### Slide 1

```text
Your photographer captures the big moments.
```

### Slide 2

```text
But your guests capture everything happening in between.
```

### Slide 3

```text
The blurry dance floor photo.
The late-night selfie.
Grandpa laughing at the table.
```

### Slide 4

```text
SameRoll puts every guest photo into one shared roll.
```

### Slide 5

```text
So no memory disappears in 40 different camera rolls.
```

Der Text wird automatisch passend zur Slide-Länge optimiert.

---

# 7. CTA Slide

Die CTA Slide funktioniert ähnlich wie die Hook Slide.

Der Nutzer kann:

- CTAs manuell eintragen
- AI CTAs generieren lassen
- mehrere CTA-Varianten aktivieren

Beispiele:

```text
Download SameRoll and start your first roll.

Try SameRoll for your next event.

One event. One roll. Every memory.

Available now on the App Store.
```

Die CTA Slide kann ebenfalls deaktiviert werden.

---

# 8. Image Library

## 8.1 Globale Library

Das Tool besitzt eine zentrale Medienbibliothek.

Unterstützte Formate:

- JPG
- PNG
- HEIC
- WEBP

Später:

- Video
- GIF
- AI-generated Images

---

## 8.2 Alben

Bilder können in beliebig viele Alben organisiert werden.

Beispiele:

```text
Wedding Hooks
Wedding Content
Wedding CTA
Party Hooks
Party Content
Birthday Content
Lifestyle
Product Screenshots
UGC
```

Ein Bild kann optional mehreren Alben zugeordnet werden.

---

## 8.3 Album-Zuordnung pro Slide-Typ

Jede Kampagne kann verschiedene Alben verwenden.

Beispiel:

```text
Hook → Wedding Hooks
Content → Wedding Content
CTA → SameRoll CTA
```

Optional kann auch jede einzelne Slide ein eigenes Album verwenden.

Beispiel:

```text
Slide 1 → Wedding Couple
Slide 2 → Wedding Guests
Slide 3 → Dance Floor
Slide 4 → App Screenshots
Slide 5 → Wedding CTA
```

---

# 9. Image Rotation Engine

Bei jeder generierten Variante zieht das System andere Bilder aus den ausgewählten Alben.

Beispiel:

Album enthält 20 Bilder.

Ein Post benötigt 5 Bilder.

Das System kann daraus zahlreiche unterschiedliche Posts erstellen.

### Regeln

- möglichst keine identischen Posts
- keine Bilddopplung innerhalb eines Posts, sofern genügend Bilder vorhanden sind
- Bilder gleichmäßig über alle Posts verteilen
- kürzlich verwendete Bilder niedriger priorisieren
- besonders erfolgreiche Bilder später optional stärker gewichten
- Nutzer kann Bilder sperren
- Nutzer kann Bilder als Favoriten markieren

### Option

```text
Avoid using the same image again within:
[ 5 ] generated posts
```

---

# 10. AI Content Engine

Die AI benötigt nur wenige Inputs.

## Input

```text
Topic
Product / Brand
Target Audience
Goal
Tone
Language
Number of Content Slides
Number of Variations
```

Beispiel:

```text
Product: SameRoll
Topic: Wedding guest photos
Audience: Brides planning their wedding
Goal: App downloads
Tone: Emotional / relatable
Language: English
Content Slides: 5
Variations: 20
```

---

## Output

Das Tool generiert beispielsweise:

```text
20 Hook Variants
20 Content Sequences
10 CTA Variants
```

Diese Inhalte werden automatisch kombiniert.

---

# 11. Variation Engine

Das System soll nicht einfach denselben Post mit anderen Bildern erzeugen.

Es kann unterschiedliche Ebenen variieren.

## Variation Types

### Hook Variation

Andere Hook.

### Text Variation

Andere Formulierung desselben Inhalts.

### Story Variation

Andere Argumentationsstruktur.

Beispiel:

```text
Variant A
Problem → Problem → Solution → Benefit → CTA

Variant B
Story → Emotion → Problem → Solution → CTA

Variant C
Contrarian Hook → Insight → Example → Solution → CTA
```

### Image Variation

Andere Bilder aus den jeweiligen Alben.

### CTA Variation

Andere CTA.

---

# 12. Generate Posts

Oben rechts befindet sich der zentrale Button:

```text
Generate
```

Beim Klick öffnet sich ein Dialog.

```text
Generate Posts

Number of Posts
[ 20 ]

Variation
[x] Rotate Images
[x] Rotate Hooks
[x] Rewrite Content
[x] Rotate CTA

Avoid identical combinations
[x]

[ Generate 20 Posts ]
```

Danach erscheinen alle Varianten in einer Übersicht.

---

# 13. Generated Posts View

Darstellung als Grid.

```text
Post #01
Hook A
Images 3 / 8 / 12 / 19
CTA C

Post #02
Hook C
Images 2 / 6 / 9 / 14
CTA A
```

Jeder Post kann:

- geöffnet
- bearbeitet
- dupliziert
- gelöscht
- geplant
- direkt veröffentlicht
- als TikTok Draft übertragen
- erneut generiert

werden.

---

# 14. Slide Editor

Jede Slide kann manuell angepasst werden.

## Funktionen

- Text bearbeiten
- Bild austauschen
- Bild verschieben
- Bild skalieren
- Crop ändern
- Overlay einstellen
- Schriftart ändern
- Schriftgröße ändern
- Textposition ändern
- Textausrichtung ändern
- Textfarbe ändern
- Shadow einstellen
- Background Blur einstellen
- Textbox-Breite ändern

---

# 15. Text Styles

Der Nutzer kann Text Styles speichern.

Beispiele:

### Minimal

```text
White Bold
Center
48px
Soft Shadow
```

### TikTok Classic

```text
White Bold
Black Stroke
Center
```

### Editorial

```text
Serif
Left aligned
Bottom third
```

Styles können auf einzelne Slides oder die komplette Kampagne angewendet werden.

---

# 16. Brand Presets

Optional kann ein Nutzer Brand Presets speichern.

```text
Brand Name
Logo
Font
Primary Color
Secondary Color
Text Style
CTA Style
```

Beispiel:

```text
SameRoll
Font: Inter
Style: Minimal
Overlay: Dark Gradient
Logo: Off
```

---

# 17. Live Preview

Über den Button

```text
Preview
```

öffnet sich eine TikTok-ähnliche Vorschau.

Der Nutzer kann horizontal durch die Slides swipen.

Anzeige:

- Bilder
- Text
- Textposition
- Slide-Reihenfolge

Optional später:

- TikTok Caption
- Account Name
- Likes / Comments Mock UI

---

# 18. TikTok Account Integration

Nutzer können einen oder mehrere TikTok Accounts verbinden.

Beispiele:

```text
@getsameroll
@sameroll.de
@samerollweddings
```

OAuth sollte für die Verbindung verwendet werden.

Pro Kampagne kann ein Standardaccount definiert werden.

---

# 19. Publishing

Ein generierter Post kann unterschiedliche Status besitzen.

```text
Draft
Ready
Scheduled
Publishing
Published
Failed
```

Mögliche Aktionen:

### Publish Now

Post direkt veröffentlichen.

### Schedule

Post für einen Zeitpunkt planen.

### Send to TikTok Drafts

Falls durch die TikTok API / Content Posting API technisch unterstützt, wird der Post als Draft an TikTok übertragen.

Falls Draft-Synchronisation nicht verfügbar ist, soll die UX einen alternativen Publish-Workflow anbieten, ohne dem Nutzer eine nicht vorhandene API-Funktion vorzutäuschen.

---

# 20. Scheduler

Der Nutzer kann einen Posting Rhythmus einstellen.

Beispiel:

```text
Timezone
Europe/Berlin

Posting Frequency
2x per day

Times
09:00
18:30

Days
Mon Tue Wed Thu Fri Sat Sun
```

Weitere Optionen:

```text
Post every X hours
Randomize posting time ± 15 minutes
Skip weekends
Maximum posts per day
```

---

# 21. Queue

Geplante Posts landen in einer Queue.

Beispiel:

```text
Today
09:00  SameRoll Wedding #18
18:30  SameRoll Wedding #19

Tomorrow
09:00  SameRoll Party #05
18:30  SameRoll Wedding #20
```

Posts können per Drag & Drop verschoben werden.

---

# 22. Performance Analytics

Nach Veröffentlichung sollen Performance-Daten gesammelt werden, sofern die TikTok APIs dies zulassen.

Mögliche KPIs:

- Views
- Likes
- Comments
- Shares
- Saves / Favorites, falls verfügbar
- Engagement Rate
- Profile Visits, falls verfügbar
- Link Clicks, falls verfügbar

Wichtig ist nicht nur Post-Performance, sondern die Analyse einzelner Komponenten.

---

# 23. Hook Analytics

Beispiel:

| Hook | Posts | Avg Views | Avg Engagement |
|---|---:|---:|---:|
| Your photographer won't capture this | 12 | 18.400 | 8.2% |
| POV: every guest becomes your photographer | 10 | 9.200 | 6.1% |
| Nobody tells brides this | 8 | 31.800 | 10.4% |

So erkennt der Nutzer, welche Hooks funktionieren.

---

# 24. Image Analytics

Jedes Bild erhält eine eigene Performance-Historie.

Beispiel:

```text
Image: wedding_034.jpg

Used in: 18 Posts
Average Views: 14,210
Average Engagement: 7.8%
Performance Score: 82
```

Dadurch kann die Image Rotation Engine später erfolgreiche Bilder häufiger auswählen.

---

# 25. CTA Analytics

Auch CTAs werden miteinander verglichen.

Beispiel:

```text
Download SameRoll → Avg. 12.4K Views
Try SameRoll for your wedding → Avg. 18.2K Views
One event. One roll. Every memory. → Avg. 21.5K Views
```

---

# 26. Winner Detection

Das Tool soll automatisch erfolgreiche Muster erkennen.

Beispiel:

```text
Winning Combination

Hook Style:
Contrarian

Images:
People / candid moments

Content Length:
5 slides

CTA:
Soft CTA
```

Später kann die AI daraus automatisch weitere Variationen erzeugen.

---

# 27. Auto Optimization – spätere Ausbaustufe

Langfristig soll das System einen geschlossenen Optimierungsloop bilden.

```text
Generate
   ↓
Publish
   ↓
Measure
   ↓
Analyze
   ↓
Generate Better Variants
   ↓
Publish
```

Dadurch wird das Tool langfristig zu einem automatischen Organic Growth System.

---

# 28. Navigation

Desktop Sidebar:

```text
Logo

Home
Campaigns
Library
Calendar
Analytics

────────────

Connections
Brand Settings
Settings
```

---

# 29. Home Dashboard

Dashboard Widgets:

```text
Posts Published
Views
Engagement
Connected Accounts
```

Darunter:

### Active Campaigns

Liste aktiver Kampagnen.

### Upcoming Posts

Nächste geplante Posts.

### Top Performing Hooks

Beste Hooks der letzten 7 / 30 Tage.

### Top Performing Images

Bilder mit der besten Performance.

---

# 30. Futuristic Design System

Das Design soll **futuristisch, hochwertig, minimalistisch und technisch** wirken.

Nicht verspielt.

Nicht wie ein klassisches Social Media Management Tool.

Inspiration:

- Linear
- Raycast
- Vercel
- modern AI SaaS
- Apple Pro Apps
- Cyber/Futuristic UI nur sehr subtil

## Grundstil

```text
Dark UI
Deep Black Background
Glass Panels
Thin Borders
Subtle Glow
High Contrast Typography
Minimal Accent Colors
```

### Farben

```text
Background Primary:    #050505
Background Secondary:  #0B0C0F
Panel:                 #111216
Panel Hover:           #17191E
Border:                #24262D
Text Primary:          #F5F7FA
Text Secondary:        #8D939F
Accent Primary:        #5BFFB7
Accent Secondary:      #6C63FF
Error:                 #FF5B6E
Warning:               #FFCB6B
```

Optional können leichte Gradient-Akzente verwendet werden:

```text
#5BFFB7 → #4CC9F0
```

Glow nur an wichtigen Interaktionen:

- aktive Kampagne
- Generate Button
- ausgewählte Slide
- AI Aktionen

---

# 31. UI Details

## Cards

- Radius: 14–18px
- dünner Border
- sehr leichter Glass-Effekt
- keine harten Schatten

## Buttons

Primary Button:

```text
Generate ✦
```

- kräftiger Accent
- leichte Glow Animation beim Hover

Secondary Buttons:

- dunkler Hintergrund
- heller Border

## Slides

Aktive Slide:

```text
1px Accent Border
Soft Outer Glow
```

Slide-Typ als kleines Label:

```text
HOOK
CONTENT
CTA
```

---

# 32. AI UX

AI-Funktionen sollen nicht wie ein Chatbot wirken.

Stattdessen kurze Aktionen direkt im Workflow.

Beispiele:

```text
✦ Generate Hooks
✦ Rewrite
✦ Make shorter
✦ Make more emotional
✦ Make more controversial
✦ Generate Variants
✦ Improve CTA
```

Die AI soll sich wie ein eingebauter Creative Copilot anfühlen.

---

# 33. Campaign Creation Flow

```text
Create Campaign
      ↓
Campaign Name
      ↓
Select TikTok Account
      ↓
Select / Create Albums
      ↓
Choose Slide Structure
      ↓
Define Topic
      ↓
Generate Content
      ↓
Preview
      ↓
Generate Variants
      ↓
Schedule / Publish
```

---

# 34. Beispiel Campaign Setup

## Campaign

```text
SameRoll – Wedding Germany
```

## Structure

```text
1 Hook
4 Content Slides
1 CTA
```

## Albums

```text
Hook → Wedding Emotional
Content → Wedding Moments
CTA → SameRoll Product
```

## Topic

```text
Why guests often take the most authentic wedding photos and how SameRoll collects every photo in one shared roll.
```

## Audience

```text
Women 23–35 planning their wedding
```

## Tone

```text
Emotional
Relatable
Modern
Short sentences
```

## Variants

```text
30 Posts
```

---

# 35. Suggested Data Model

## User

```text
id
email
name
created_at
```

## Workspace

```text
id
name
owner_id
created_at
```

## Campaign

```text
id
workspace_id
name
status
language
topic
audience
goal
tone
created_at
updated_at
```

## Album

```text
id
workspace_id
name
created_at
```

## Asset

```text
id
workspace_id
file_url
thumbnail_url
width
height
hash
created_at
```

## AlbumAsset

```text
album_id
asset_id
```

## CampaignAlbum

```text
campaign_id
album_id
usage_type
```

`usage_type`:

```text
HOOK
CONTENT
CTA
```

## Hook

```text
id
campaign_id
text
enabled
source
created_at
```

## CTA

```text
id
campaign_id
text
enabled
source
created_at
```

## ContentSequence

```text
id
campaign_id
name
created_at
```

## ContentSlide

```text
id
content_sequence_id
position
text
```

## Post

```text
id
campaign_id
tiktok_account_id
status
scheduled_at
published_at
external_post_id
created_at
```

## PostSlide

```text
id
post_id
position
slide_type
asset_id
text
text_style_id
```

## TikTokAccount

```text
id
workspace_id
platform_user_id
username
access_token_encrypted
refresh_token_encrypted
token_expires_at
created_at
```

## PostMetric

```text
id
post_id
views
likes
comments
shares
engagement_rate
recorded_at
```

---

# 36. Backend Services

Empfohlene logische Services:

```text
Auth Service
Campaign Service
Asset Service
AI Generation Service
Post Generation Service
Rendering Service
Scheduling Service
TikTok Integration Service
Analytics Service
```

---

# 37. Rendering Engine

Für jede Slide muss serverseitig oder clientseitig ein finales Bild gerendert werden.

Output:

```text
1080 x 1920
9:16
PNG / JPG
```

Rendering Pipeline:

```text
Original Image
      ↓
Crop / Resize
      ↓
Overlay
      ↓
Text Layer
      ↓
Brand Elements
      ↓
Final 1080x1920 Asset
```

Wichtig:

- Text muss unabhängig vom Gerät identisch rendern
- Font-Dateien serverseitig verfügbar
- Zeilenumbrüche reproduzierbar
- TikTok Safe Areas berücksichtigen

---

# 38. Duplicate Prevention

Damit nicht versehentlich nahezu identische Posts entstehen, erhält jeder Post einen Combination Hash.

Beispiel:

```text
hash(
  hook_id +
  content_sequence_id +
  asset_ids +
  cta_id
)
```

Existiert die Kombination bereits, wird eine neue Kombination erzeugt.

---

# 39. AI Prompt Context

Die AI sollte pro Kampagne Kontext speichern.

Beispiel:

```text
Brand:
SameRoll

Product:
Shared photo roll for events.

Audience:
People organizing weddings, birthdays and parties.

Brand Voice:
Emotional, modern, short, slightly playful, never corporate.

Avoid:
Marketing jargon.
Overly long sentences.
Generic AI phrases.
```

Dadurch muss der Nutzer nicht bei jeder Generierung alles erneut erklären.

---

# 40. Guardrails für AI Content

AI Output muss:

- zur gewünschten Sprache passen
- pro Slide kurz genug sein
- keine erfundenen Produktfeatures enthalten
- keine nicht belegten Zahlen behaupten
- keine Hashtags innerhalb der Slides generieren, sofern nicht explizit gewünscht
- natürlich und social-first formuliert sein
- keine typischen AI-Floskeln verwenden

---

# 41. Caption Generator

Zusätzlich zum Slide Text kann das Tool automatisch TikTok Captions generieren.

Input:

```text
Caption Style
Hashtags
Language
CTA
```

Output beispielsweise:

```text
Your guests already took the memories. Now you just need one place to collect them. 🎞️

#WeddingTok #WeddingIdeas #WeddingPhotos #SameRoll
```

Mehrere Caption-Varianten können ebenfalls rotiert werden.

---

# 42. Post Generation Strategy

Bei 20 gewünschten Posts könnte die Engine beispielsweise folgende Parameter kombinieren:

```text
5 Hooks
4 Content Sequences
4 CTAs
30 Images
```

Anstatt alle theoretischen Kombinationen zu erzeugen, erstellt die Engine eine ausgewogene Stichprobe.

Prioritäten:

1. hohe Variation
2. gleichmäßige Asset-Nutzung
3. keine Duplikate
4. unterschiedliche Hooks
5. unterschiedliche Story-Strukturen

---

# 43. MVP / Version 1

Die erste produktive Version sollte folgende Funktionen enthalten:

### Core

- User Login
- Campaigns erstellen
- Campaigns bearbeiten
- Bild Upload
- Alben erstellen
- Hook Album auswählen
- Content Album auswählen
- CTA Album auswählen
- Hook Texte verwalten
- AI Hooks generieren
- Anzahl Content Slides festlegen
- Content Topic eingeben
- AI Content Slides generieren
- CTA Texte verwalten
- AI CTA generieren
- Text Style auswählen
- Post Preview
- mehrere Posts generieren
- automatische Bildrotation
- einzelne Posts bearbeiten
- fertige Slides exportieren
- TikTok Account verbinden
- Posting / Scheduling, soweit API-seitig möglich

---

# 44. Version 1.1

- Analytics
- Hook Performance
- Image Performance
- CTA Performance
- Auto Winner Detection
- Caption Generator
- Saved Brand Presets
- mehrere TikTok Accounts
- Content Calendar

---

# 45. Version 2

- Instagram Carousel Publishing
- Instagram Reels
- YouTube Shorts
- Pinterest
- LinkedIn Carousels
- AI Image Generation
- AI UGC Generation
- Automated Content Research
- Competitor Monitoring
- Trend Detection
- Automatic Content Iteration

---

# 46. Langfristige Vision

Das Produkt soll sich von einem TikTok Slide Generator zu einem vollständigen **AI Marketing Operating System** entwickeln.

Das System übernimmt langfristig den gesamten Loop:

```text
Research
   ↓
Ideation
   ↓
Creation
   ↓
Variation
   ↓
Publishing
   ↓
Analytics
   ↓
Optimization
   ↓
New Content
```

Der Nutzer gibt im Idealfall nur noch vor:

```text
What are you marketing?
Who are you trying to reach?
What is your goal?
```

Der Rest wird vom System vorbereitet, getestet und optimiert.

---

# 47. UX-Leitprinzipien

1. **Campaign-first statt Post-first**  
   Der Nutzer baut kein einzelnes Bild, sondern ein wiederverwendbares Content-System.

2. **Variation by default**  
   Jeder Teil eines Posts kann automatisch getestet werden.

3. **AI embedded, not chat-based**  
   AI erscheint direkt dort, wo sie gebraucht wird.

4. **Three-click generation**  
   Thema festlegen → Assets auswählen → Generate.

5. **Visual feedback sofort**  
   Jede Änderung muss direkt in der Preview sichtbar sein.

6. **Performance wird auf Komponenten heruntergebrochen**  
   Nicht nur „Post A war gut“, sondern „Hook X + Bildstil Y + CTA Z funktioniert gut“.

7. **Futuristic, but usable**  
   Optisch klar AI-/Tech-orientiert, aber ohne die Bedienbarkeit einem Sci-Fi-Look zu opfern.

---

# 48. Wichtigster Differenzierungsfaktor

Das Produkt ist **kein Canva-Klon und kein gewöhnlicher Social Scheduler**.

Der Kern ist:

> Ein Nutzer baut einmal eine Kampagne aus Content, Hooks, CTAs und Bildalben. Das System erzeugt daraus automatisch viele unterschiedliche Social Posts, veröffentlicht sie, misst die Performance einzelner Bestandteile und nutzt diese Daten, um zukünftige Varianten zu verbessern.

Das ist der zentrale Produktgedanke, auf dem alle weiteren Features aufbauen sollten.
