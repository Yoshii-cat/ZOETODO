-- Zoe "Today" — initial schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> Run).
-- Safe to re-run: everything is guarded with "if not exists" / "on conflict do nothing".

create table if not exists tasks (
  id text primary key,
  name text not null,
  subtitle text default '',
  sort_order int not null,
  active boolean default true
);

create table if not exists completions (
  id bigserial primary key,
  task_id text references tasks(id),
  day date not null,
  status text not null check (status in ('done','skipped')),
  recap text,          -- required when status = done
  reason text,         -- required when status = skipped
  created_at timestamptz default now(),
  unique (task_id, day)
);

create index if not exists completions_day_idx on completions (day);
create index if not exists completions_task_day_idx on completions (task_id, day);

-- Every read and write happens server side with the service role key, which
-- bypasses RLS. RLS is still enabled so that a leaked anon key cannot read
-- anything: there are deliberately no policies.
alter table tasks enable row level security;
alter table completions enable row level security;

-- Seed the task list.
insert into tasks (id, name, subtitle, sort_order, active) values
  ('homework',    'Homework',             'Every school day', 1, true),
  ('study',       'Studying',             '30 minutes',       2, true),
  ('workout',     'Workout',              'Move for 20 min',  3, true),
  ('biofeedback', 'Biofeedback',          'One session',      4, true),
  ('blog',        'Blog',                 'Write or edit',    5, true),
  ('dj',          'DJ practice',          'One mix',          6, true),
  ('batmitzvah',  'Bat mitzvah practice', 'Torah portion',    7, true),
  ('me',          'ME',                   '',                 8, true),
  ('ne',          'NE',                   '',                 9, true)
on conflict (id) do nothing;
