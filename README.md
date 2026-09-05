# Today — Zoe's daily checklist

Two screens.

- **`/`** — the iPad screen. Nine tiles, no login. Tap a tile, say what you did, it turns lime. Tap "skip" and say why, it turns coral. The list clears at midnight.
- **`/parents`** — PIN-gated dashboard: this week's grid, completions over the last 4 and 12 weeks, current streaks, and a searchable log of everything she wrote. Open it and refresh whenever you like.

Next.js (App Router, TypeScript) on Vercel, Postgres on Supabase.
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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → the `service_role` / `sb_secret_...` key. **Server only. Never expose this to a browser.** |
| `PARENT_PIN` | Whatever you want to type to get into `/parents` |

**One Vercel setting matters:** the iPad page has no login of its own, so Vercel's
**Deployment Protection** must be off for production. Project → Settings → Deployment
Protection → set *Vercel Authentication* to **Only Preview Deployments** (or disabled). If it is
left on, the iPad sees a Vercel login screen instead of the checklist.

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
- **Turn a task off**, which hides it from her screen but keeps every past
  entry intact. Turn it back on any time.

Task ids are generated from the name and never change, so renaming "Studying" to "Study time"
keeps all of its history attached.

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
- **Cold start is fine.** With an empty `completions` table every tile is simply open and the
  charts read zero.
- `prefers-reduced-motion` turns off every animation and transition.

## Project layout

```
src/app/page.tsx              server: today's tasks + completions in New York time
src/app/TodayClient.tsx       the iPad screen
src/app/parents/              PIN gate, week grid, charts, streaks, log, task manager
src/app/api/completions/      GET / POST / DELETE for today's rows
src/app/api/tasks/            task manager writes (PIN gated)
src/app/api/parents/login/    PIN in, hashed cookie out
src/lib/date.ts               every New York date helper
src/lib/streak.ts             streak rules
src/lib/supabase.ts           server-only client (service role)
supabase/migrations/          the SQL to paste into Supabase
```
