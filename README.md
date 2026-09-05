# Today — Zoe's daily checklist

Two screens and one email.

- **`/`** — the iPad screen. Nine tiles, no login. Tap a tile, say what you did, it turns lime. Tap "skip" and say why, it turns coral. The list clears at midnight.
- **`/parents`** — PIN-gated dashboard: this week's grid, completions over the last 4 and 12 weeks, current streaks, and a searchable log of everything she wrote.
- **8pm email** — a nightly digest to whoever is in `DIGEST_TO`, with her recaps in her own words.

Next.js (App Router, TypeScript) on Vercel, Postgres on Supabase, email through Resend.
Every date and time in the app is **America/New_York**, decided on the server, never on the device.

---

## 1. Run the SQL migration

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
3. Click **Run**.

That creates the `tasks` and `completions` tables and seeds the nine starting tasks. The
script is safe to run twice — every statement is guarded with `if not exists` or
`on conflict do nothing`, so re-running it will not wipe any history.

Row level security is on for both tables with **no policies**, on purpose. The app only ever
talks to Supabase from the server using the service role key, which bypasses RLS. If the anon
key ever leaks it can read nothing.

## 2. Set the environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local` for local work, and set the
same keys in Vercel under **Settings → Environment Variables** (Production, Preview, and
Development).

| Variable | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` secret. **Server only. Never expose this to a browser.** |
| `RESEND_API_KEY` | Resend → API Keys |
| `DIGEST_TO` | Comma-separated list of everyone who gets the 8pm email |
| `DIGEST_FROM` | `onboarding@resend.dev` works out of the box; swap in your own verified domain later |
| `PARENT_PIN` | Whatever you want to type to get into `/parents` |
| `CRON_SECRET` | Any long random string. Vercel sends it to `/api/digest` as a bearer token. Generate one with `openssl rand -hex 32` |

Optionally set `NEXT_PUBLIC_SITE_URL` (e.g. `https://zoe-today.vercel.app`) so the link at the
bottom of the email always points at your real domain rather than at whichever deployment URL
happened to run the cron.

No real keys are committed to this repo, and `.env.local` is gitignored.

## 3. Run it locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## 4. Add it to the iPad home screen

1. Open the deployed URL in **Safari** on the iPad (it has to be Safari — Chrome on iOS cannot
   install web apps).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the new "Today" icon. It opens full screen with no browser chrome, in
   portrait or landscape.

The recap box is a plain text field, so the **mic key on the iPad keyboard** dictates into it.
That is the intended way for her to fill it in.

There is no login on this page by design. The iPad is the key.

## 5. Change the tasks

Go to **`/parents`**, enter the PIN, and use the **Tasks** section at the bottom. You can:

- **Rename** a task or change its subtitle — click the field, type, click away. It saves on blur.
- **Reorder** with the ↑ / ↓ buttons. The order there is the order of the tiles on the iPad.
- **Add** a task with the row at the bottom.
- **Turn a task off**, which hides it from her screen and from the digest but keeps every past
  entry intact. Turn it back on any time.

Task ids are generated from the name and never change, so renaming "Studying" to "Study time"
keeps all of its history attached.

## How the 8pm digest works

Vercel Cron schedules in UTC, and 8pm in New York is 00:00 UTC in summer but 01:00 UTC in
winter. The Vercel **Hobby plan only allows cron jobs that run once a day**, so
[`vercel.json`](vercel.json) schedules `/api/digest` twice — once at each of those hours — and
the handler returns immediately unless it is actually the 8pm hour in New York. One run sends,
the other skips. Nothing to adjust for daylight saving, and nothing to upgrade.

Hobby cron jobs can fire anywhere within their scheduled hour rather than exactly on the
minute, so the email may land between 8:00 and 8:59pm.

The route is protected by `CRON_SECRET`, which Vercel sends as `Authorization: Bearer <secret>`.
Requests without it get a 401.

**To preview tonight's email in a browser:** sign in at `/parents`, then click
*"Preview tonight's email"* (or go to `/api/digest?preview=1`). It renders the exact HTML that
would be sent, with the subject line in an HTML comment at the top, and sends nothing. Add
`&day=2026-09-04` to preview any past day.

**To send one right now for testing:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR-DOMAIN/api/digest?force=1"
```

The `force=1` parameter bypasses the 8pm check. It still requires the bearer token.

Subject line format: `Zoe, Thu Sep 4: 6 done, 1 skipped, 2 not started`

## Notes on behavior

- **A tile only turns green once a recap of 3+ characters is saved.** The recap sheet has no
  cancel button — that is deliberate.
- **Skipping requires a reason** of 3+ characters before the confirm button enables.
- **Tapping a finished or skipped tile asks "Undo?"** and deletes the row outright.
- **The day rolls over on the server.** The iPad re-checks every minute and whenever it comes
  back to the foreground, so a tablet left running overnight (or one with a wrong clock) still
  gets a fresh list at New York midnight.
- **Streaks** count consecutive days done, ending today. Today is treated as still open, so an
  untouched task does not zero out the streak until the day is over — but an explicit skip
  does. Homework and studying ignore weekends.
- **Cold start is fine.** With an empty `completions` table every tile is simply open, the
  charts read zero, and the digest reports everything as not started.
- `prefers-reduced-motion` turns off every animation and transition.

## Project layout

```
src/app/page.tsx              server: today's tasks + completions in New York time
src/app/TodayClient.tsx       the iPad screen
src/app/parents/              PIN gate, week grid, charts, streaks, log, task manager
src/app/api/completions/      GET / POST / DELETE for today's rows
src/app/api/tasks/            task manager writes (PIN gated)
src/app/api/parents/login/    PIN in, hashed cookie out
src/app/api/digest/           hourly cron + browser preview
src/lib/date.ts               every New York date helper
src/lib/streak.ts             streak rules
src/lib/digest.ts             digest data + email HTML
src/lib/supabase.ts           server-only client (service role)
supabase/migrations/          the SQL to paste into Supabase
```
