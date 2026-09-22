# MVP-Spezifikation – TikTok Slideshow Autopilot (intern)

Stand: 2026-09-22 · ersetzt für die Umsetzung das PRD (`marketing_tool_tiktok_slides_prd.md`), das die Langfrist-Vision bleibt.
Referenz-Produkt: [Volume](https://tryvolume.app/guides/first-campaign).

## 1. Rahmen

- **Nutzer:** nur wir, für unsere eigenen Apps. Kein Billing, kein öffentlicher Signup (Invite-only über Supabase Auth).
- **Plattform:** nur TikTok Photo-Posts (Slideshows). Instagram/Stitch (Video) später.
- **UI-Sprache:** Englisch. Content-Sprache pro Kampagne wählbar.
- **Ziel:** so schnell wie möglich produktiv. Jede Phase (§8) ist für sich nutzbar.

## 2. Kernkonzept: Kampagne = Agent

Eine Kampagne ist ein Regelwerk, kein Stapel fertiger Posts. Zu jedem geplanten Zeitpunkt baut sie **einen neuen Post**:

```
Slot fällig
  → Hook zufällig/rotierend aus aktiven Hooks
  → Content-Slides frisch per AI (Prompt + Format + Länge + Ton, Produkt-Fakten als Kontext)
  → CTA rotierend
  → pro Slide ein Bild aus der zugeordneten Library (Rotation, s. §5)
  → Caption per AI
  → Rendern (1080×1920 JPEG)
  → an TikTok: Drafts (Inbox) oder direkt ins Profil
```

Zusätzlich jederzeit: **„Generate preview“** (Post bauen ohne zu posten) und **„Post now“**.
Batch-Generierung („20 Posts vorab“) aus dem PRD entfällt im MVP; Preview + Queue decken den Bedarf.

## 3. Slide-Aufbau einer Kampagne

| Slot | Text | Bild | Styling |
|---|---|---|---|
| Hook (1) | aus Hook-Liste (manuell + „✦ Generate hooks“) | Library A | Text-Style + Textbox-Position |
| Content (1–10) | AI pro Post; Format *Numbered / Steps / Plain*, Länge *5–7 / 10–12 / 15–20 Wörter*, Ton *Plain / Punchy / Expert / Warm* | Library B (optional pro Slide eigene Library) | wie oben |
| CTA (0–1) | aus CTA-Liste oder leer (reines App-Shot-Bild) | Library C | wie oben |

**Drag & Drop (MVP):** Im Kampagnen-Editor wird die Textbox pro Slide-Typ auf einer 9:16-Vorschau verschoben und in der Breite gezogen (Position in 1080×1920-Koordinaten gespeichert). Gilt für alle generierten Posts; einzelne Posts können danach vor dem Posten nachbearbeitet werden (Text, Bild tauschen, Position). Slide-Reihenfolge innerhalb der Content-Slides per DnD.

TikTok-Safe-Areas werden im Editor als Overlay angezeigt.

## 4. Produkte (Brand-Kontext)

Da wir mehrere Apps haben: Entität **Product** (Name, Beschreibung, **belegte Fakten/Features**, Voice, „Avoid“-Liste, App-Store-Link). Jede Kampagne gehört zu einem Produkt. Die AI darf nur Features aus den Fakten nennen.

## 5. Bild-Rotation

- Keine Bilddopplung innerhalb eines Posts (wenn Library groß genug).
- Least-recently-used pro Library & Kampagne, mit Zufall unter den N am längsten ungenutzten.
- `locked` = nie verwenden, `favorite` = doppeltes Gewicht.
- Uploads: JPG/PNG/WEBP/HEIC → beim Upload normalisiert (sharp), Original + Thumbnail in Supabase Storage.

## 6. TikTok-Integration

- **Login Kit + Content Posting API**, Scopes: `user.info.basic`, `video.publish`, `video.upload`, später `video.list`, `user.info.stats`.
- **Drafts-Modus** (`post_mode: MEDIA_UPLOAD`): Post landet in der TikTok-Inbox, wir veröffentlichen in der App. **Default** und im MVP der Hauptweg, da ohne TikTok-Audit direkte Posts nur privat (`SELF_ONLY`) erscheinen.
- **Direct-Post-Modus** (`DIRECT_POST`): erst nach bestandenem Audit sinnvoll. Die Settings bilden die von TikTok geforderte UX ab: Sichtbarkeit (Everyone/Friends/Only me, aus `creator_info` geladen), Kommentare erlauben, Commercial-Content-Disclosure, AI-Label, Hinweis auf Music Usage Confirmation.
- Fotos nur **JPEG/WEBP** via `PULL_FROM_URL` von einer **bei TikTok verifizierten Domain** → gerenderte Bilder werden über eine Route unserer eigenen Domain ausgeliefert (`https://<domain>/media/...`), nicht über die supabase.co-URL.
- Token-Refresh per Cron; Status-Polling über `publish/status/fetch`.
- Vor jeder Annahme: Limits und Formate gegen die aktuelle TikTok-Doku prüfen.

## 7. Architektur

| Baustein | Wahl |
|---|---|
| App | Next.js (App Router, TypeScript), Tailwind, shadcn/ui, dnd-kit |
| Backend | Supabase: Postgres, Auth (invite-only), Storage, RLS |
| AI | Claude API mit Structured Outputs; Sonnet für Content/Captions, Haiku für Rewrites |
| Web-Recherche (optional pro Kampagne) | Claude Web Search Tool |
| Rendering | Eine React-Slide-Komponente (1080×1920) für Editor **und** Server; Server rendert per Headless Chromium (`@sparticuz/chromium` + `playwright-core`) → identische Zeilenumbrüche. Fonts liegen im Repo. |
| Scheduler | Supabase `pg_cron` ruft alle 5 Min eine geschützte API-Route (`/api/cron/tick`) per `pg_net` auf |
| Hosting | Vercel + eigene Domain (auch für TikTok-Verifizierung und Privacy/Terms-Seiten) |

Hinweis: Kein Docker lokal → wir arbeiten gegen ein gehostetes Supabase-Projekt (Dev), Migrationen als SQL-Dateien in `supabase/migrations`.

## 8. Datenmodell

Alle Tabellen tragen `workspace_id` (heute genau ein Workspace), damit ein späteres SaaS keine Migration aller Tabellen braucht.

```
workspaces            id, name
workspace_members     workspace_id, user_id, role
products              id, workspace_id, name, description, facts, voice, avoid, app_store_url
libraries             id, workspace_id, name
assets                id, workspace_id, storage_path, thumb_path, width, height, sha256, favorite, locked
library_assets        library_id, asset_id, added_at
text_styles           id, workspace_id, name, spec jsonb  (font, size, weight, color, stroke, shadow, bg-box, align)
tiktok_accounts       id, workspace_id, open_id, username, display_name, avatar_url, scopes, status
tiktok_tokens         account_id, access_token, refresh_token, expires_at   (nur service_role, keine RLS-Leserechte)
campaigns             id, workspace_id, product_id, name, status(draft|active|paused),
                      language, content_prompt, content_slide_count, content_format, content_length, tone, web_research,
                      caption_prompt, hashtags,
                      layout jsonb  (pro Slide-Typ: library_id, text_style_id, box{x,y,w}),
                      tiktok_account_id, publish_mode(draft|direct), privacy_level, allow_comments,
                      disclose_commercial, ai_label, timezone
campaign_hooks        id, campaign_id, text, enabled, style, source(manual|ai)
campaign_ctas         id, campaign_id, text, enabled, source
schedule_slots        id, campaign_id, time_of_day, weekdays int[]
posts                 id, workspace_id, campaign_id, tiktok_account_id, status
                      (preview|queued|rendering|uploading|in_drafts|published|failed),
                      scheduled_for, hook_id, cta_id, caption, combination_hash,
                      tiktok_publish_id, tiktok_post_id, error, published_at, created_at
post_slides           id, post_id, position, kind(hook|content|cta), asset_id, text, box jsonb, text_style_id, rendered_path
post_metrics          post_id, recorded_at, views, likes, comments, shares   (Phase 6)
```

`hook_id`, `cta_id` und `asset_id` werden am Post gespeichert (nicht nur der Text), damit spätere Hook-/Bild-/CTA-Analysen möglich sind.

## 9. Phasen

| # | Inhalt | Ergebnis |
|---|---|---|
| 0 | **Du:** Supabase-Projekt, Domain, Anthropic-Key, TikTok-Developer-Account + App anlegen | Zugänge da |
| 1 | Repo-Setup, Design-System (Farben aus PRD §30), App-Shell, Login, Privacy/Terms-Seiten (für TikTok-App-Review nötig) | läuft auf Vercel |
| 2 | Produkte, Libraries, Upload (inkl. HEIC), Bildverwaltung | Assets drin |
| 3 | Kampagnen-Editor: Hooks, Content-Prompt, CTAs, Library-Zuordnung, Text-Styles, DnD-Textbox | Kampagne definierbar |
| 4 | Generation-Engine + Renderer + Preview + **ZIP-Download** | **erster echter Nutzen:** Posts manuell hochladen |
| 5 | TikTok OAuth, Drafts-Upload, Scheduler, Queue | Autopilot (Drafts) |
| 6 | Metriken abrufen, Analytics pro Hook/CTA/Bild (mit Mindest-Stichprobe) | Lernen |
| 7 | Direct Post nach Audit, RevenueCat-Anbindung, Instagram | Ausbau |

## 10. Guardrails

- AI nennt nur Features aus `products.facts`, erfindet keine Zahlen (außer bei aktivierter Web-Recherche mit Quelle).
- Keine Hashtags in Slides; Hashtags nur in der Caption.
- Max. Wörter pro Slide wird nach der Generierung geprüft; bei Überschreitung neu generieren.
- Posting-Frequenz pro Account begrenzt (Default max. 3/Tag); neue Accounts starten im Drafts-Modus.
