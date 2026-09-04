# Build spec: "Today" daily checklist for Zoe

Build a small web app in this repo. Keep it minimal: one repo, no auth, no extra services beyond the three below.

## Stack

- Next.js (App Router, TypeScript), deployed on Vercel
- Supabase (Postgres) via `@supabase/supabase-js`, server side only using the service role key
- Resend for email
- Vercel Cron for the 8pm digest
- All dates and times in `America/New_York`

## Environment variables (already set in Vercel, also create `.env.local.example`)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
DIGEST_TO=randy@yeahdrones.com,WIFE_EMAIL_HERE
DIGEST_FROM=onboarding@resend.dev
PARENT_PIN=1234
CRON_SECRET=
```

Never commit real keys. Never call Supabase from the browser; all reads and writes go through Next.js route handlers or server actions.

## Database

Write a migration file `supabase/migrations/001_init.sql` and print instructions for running it in the Supabase SQL editor.

```sql
create table tasks (
  id text primary key,
  name text not null,
  subtitle text default '',
  sort_order int not null,
  active boolean default true
);

create table completions (
  id bigserial primary key,
  task_id text references tasks(id),
  day date not null,
  status text not null check (status in ('done','skipped')),
  recap text,          -- required when status = done
  reason text,         -- required when status = skipped
  created_at timestamptz default now(),
  unique (task_id, day)
);
```

Seed `tasks` with, in this order:

| id | name | subtitle |
|---|---|---|
| homework | Homework | Every school day |
| study | Studying | 30 minutes |
| workout | Workout | Move for 20 min |
| biofeedback | Biofeedback | One session |
| blog | Blog | Write or edit |
| dj | DJ practice | One mix |
| batmitzvah | Bat mitzvah practice | Torah portion |
| me | ME | |
| ne | NE | |

## Page 1: `/` (the iPad screen)

Match the look and behavior of `daily-checklist-mockup.html` in this repo exactly. Reuse its CSS and markup. Differences from the mockup:

- Tasks come from the `tasks` table (active only, by sort_order).
- On load, fetch completions where `day = today (New York)` and render state.
- Tapping an open tile opens the recap sheet. The tile is only marked done when a recap of 3+ characters is saved. There is no way to dismiss the recap sheet without saving. Saving writes a `done` row.
- The "skip" control opens the skip sheet. Confirm is disabled until a reason of 3+ characters is entered. Saving writes a `skipped` row.
- Tapping a done or skipped tile asks "Undo?" and deletes the row.
- The app determines "today" on the server in New York time so the list rolls over at midnight regardless of device clock.
- Add a `manifest.json` and Apple meta tags so Add to Home Screen gives a full screen app with a simple icon (lime circle, ink check mark). Title: "Today".
- No login on this page. The iPad is the key.

## Page 2: `/parents` (dashboard)

- Gate behind `PARENT_PIN` using a simple cookie after a PIN entry screen. Nothing fancy.
- Show:
  - This week: grid of tasks x days (Mon to Sun) with done / skipped / blank cells.
  - Completions per task, last 4 weeks and last 12 weeks, as bar charts (use Recharts).
  - Current streak per task (consecutive days done, weekdays only for homework and study).
  - A scrolling log of every completion with date, task, and recap or skip reason, newest first, with a task filter.
- Same visual language as the iPad page: ink background, paper tiles, lime for done, coral for skipped.
- Add a simple task manager section: rename, reorder, add, deactivate tasks. Deactivating keeps history.

## The 8pm digest

- Route handler at `/api/digest`, protected by `CRON_SECRET` (Vercel sends it as a bearer token).
- `vercel.json` cron: run at 8:00pm New York daily. Vercel cron is UTC, so set it to midnight UTC and note in the README that it needs adjusting for daylight saving, OR run hourly and have the handler exit unless it is 8pm in New York (prefer this).
- Email to everyone in `DIGEST_TO`. Subject: `Zoe, Thu Sep 4: 6 done, 1 skipped, 2 not started`.
- Body (plain HTML, mobile friendly):
  1. **Done** list: task name, time, and her recap in her own words.
  2. **Skipped** list: task name and her reason.
  3. **Not started** list: just the names.
  4. One line at the bottom: link to `/parents`.
- Also expose `/api/digest?preview=1` (PIN gated) that renders today's email in the browser for testing.

## Quality bar

- Works on iPad Safari full screen, portrait and landscape.
- Reduced motion respected. Large tap targets.
- Handles a cold start with an empty completions table gracefully.
- README with: how to run the SQL migration, how to set env vars, how to add to the iPad home screen, how to change tasks.

When done, commit and push to `main` so Vercel deploys.
