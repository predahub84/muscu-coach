-- Muscu Coach — stockage relationnel additif pour le nouveau moteur de coaching.
-- Cette migration ne remplace PAS coach_notebooks : le carnet actuel continue de fonctionner.
-- À exécuter dans Supabase SQL Editor lorsque l'on veut activer le stockage relationnel V1.

create table if not exists public.coach_programs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'generated',
  goal_type text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.coach_weekly_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  program_id text not null,
  week_number integer not null check (week_number between 1 and 104),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, program_id) references public.coach_programs(user_id, id) on delete cascade
);

create table if not exists public.coach_progression_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  program_id text,
  exercise_id text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, program_id) references public.coach_programs(user_id, id) on delete cascade
);

create index if not exists coach_programs_user_updated_idx on public.coach_programs(user_id, updated_at desc);
create index if not exists coach_reviews_user_program_week_idx on public.coach_weekly_reviews(user_id, program_id, week_number);
create index if not exists coach_progression_user_exercise_idx on public.coach_progression_events(user_id, exercise_id, created_at desc);

alter table public.coach_programs enable row level security;
alter table public.coach_weekly_reviews enable row level security;
alter table public.coach_progression_events enable row level security;

drop policy if exists "coach_programs_owner_all" on public.coach_programs;
create policy "coach_programs_owner_all" on public.coach_programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_weekly_reviews_owner_all" on public.coach_weekly_reviews;
create policy "coach_weekly_reviews_owner_all" on public.coach_weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_progression_events_owner_all" on public.coach_progression_events;
create policy "coach_progression_events_owner_all" on public.coach_progression_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Le catalogue global reste dans le code et les exercices perso restent dans le carnet courant.
-- Les programmes stockent uniquement les exerciseId + un snapshot de nom/groupe/matériel.
-- Ainsi, les historiques/charges restent liés à l'identité stable de l'exercice, pas à son libellé.
