# Slides Autopilot

Internal tool that turns campaigns (hooks, content prompt, CTAs, image libraries) into TikTok slideshow posts on a schedule.
Product spec: [SPEC.md](SPEC.md) · long-term vision: [marketing_tool_tiktok_slides_prd.md](marketing_tool_tiktok_slides_prd.md).

## Setup

1. Create a Supabase project (region EU, e.g. Frankfurt).
2. Apply the schema: Supabase dashboard → SQL Editor → run `supabase/migrations/20260922000000_init.sql`
   (or `npx supabase link` + `npx supabase db push`).
3. Auth → Sign In / Providers: disable "Allow new users to sign up". Create users under Auth → Users → Add user.
   The first user becomes owner of the default workspace.
4. `cp .env.example .env.local` and fill in URL + keys from Project Settings → API Keys.
5. `npm install && npm run dev` → http://localhost:3000

## Stack

Next.js 16 (App Router, `src/proxy.ts` handles the session), Tailwind 4, shadcn/ui (Base UI), Supabase (Postgres, Auth, Storage).

## Automatic images

Apply all migrations, including `supabase/migrations/20261009000000_automatic_images.sql`,
and configure `OPENAI_API_KEY` on the server (in addition to the existing Anthropic key).
`OPENAI_IMAGE_MODEL` defaults to `gpt-image-2`; an override must support the requested
1152×2048 portrait input size and JPEG output. See the [OpenAI Images API](https://developers.openai.com/api/reference/resources/images/methods/generate).

In Campaign → Content → Image source, select **Automatic · reuse or create**.
New campaigns default to this mode; existing campaigns keep their library behavior until switched.
Libraries are optional in automatic mode. An attached library restricts reuse to its uploaded
images plus images generated for this campaign; with no attachment, workspace uploads and this
campaign's generated images are searched. Missing descriptions are created automatically.

The final slide texts produce a shared visual plan. The worker searches eligible existing images,
checks the actual cropped image against the text, and generates an image only after exhausting
the eligible catalogue. New images are checked before being accepted and saved automatically to
`<campaign> · AI images`. No manual image upload or library maintenance is needed.
Uploaded CTA screenshots can still be selected through a dedicated CTA library.

Defaults: at most three uses per image per campaign and seven days between uses. Both limits
are configurable. Usage counts distinct retained posts (including previews and prepared posts)
over the full campaign history; deleting posts also removes their usage. No image repeats
within a post. A campaign lease serializes workers to avoid concurrent reuse decisions.

All accepted generated backgrounds are 1080×1920 JPEGs with 360×640 thumbnails. Generation
starts at 9:16; existing images retain their crop settings. Matching reviews the final crop.
The renderer validates the final output dimensions, format and 20 MB limit before storage.
These are the tool's TikTok photo-slide settings, checked against the [TikTok media guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide).
Other platforms and aspect ratios are not yet implemented. Safe-area guidance is approximate;
final composition is reviewed by AI and remains editable in the preview.

Image creation persists progress per slide. An open preview advances it through authenticated
server actions; the existing `/api/cron/tick` cron resumes it after closing the browser.
Ensure that cron is configured even for background previews. Automatic scheduled campaigns
prepare up to six hours ahead and publish completed posts only when due. Heavy backlogs or
provider errors can still delay publication. Paused campaigns do not publish prepared scheduled posts.
Manual Generate produces a preview; Send to TikTok queues it for sending after generation.

Generation allows two provider attempts per missing slide, then stops visibly on failure.
Retry preserves completed images. A provider timeout may still incur a charge; its attempt
is recorded before the call. There is no monetary budget cap in this version. After text edits,
automatic posts rematch affected images; the image shuffle button finds or creates a fresh
matching image. Explicit manual image choices remain possible. Posts using generated assets
automatically set the existing TikTok AI-content flag.

Run `npm run test:images`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` for local
validation. Image tests use simulated AI/storage responses and real image processing; they do
not incur provider charges or validate a live provider account, hosted migration, or TikTok post.
