-- Muscu Coach — profil, objectif, nutrition et check-ins V1
-- Migration additive et relançable : elle ne supprime aucune table ni donnée existante.

create table if not exists public.coach_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Athlète',
  age_years integer,
  sex text,
  height_cm numeric(6,2),
  current_weight_kg numeric(6,2),
  activity_level text,
  experience_level text,
  experience_months integer not null default 0,
  consistency text,
  health_status text,
  reported_issues jsonb not null default '[]'::jsonb,
  other_activities jsonb not null default '[]'::jsonb,
  onboarding_completed_at timestamptz,
  profile_version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_profiles_age_check check (age_years is null or age_years between 16 and 100),
  constraint coach_profiles_sex_check check (sex is null or sex in ('male','female','other','prefer_not')),
  constraint coach_profiles_height_check check (height_cm is null or height_cm between 100 and 250),
  constraint coach_profiles_weight_check check (current_weight_kg is null or current_weight_kg between 20 and 500),
  constraint coach_profiles_activity_check check (activity_level is null or activity_level in ('low','moderate','high','very_high')),
  constraint coach_profiles_experience_check check (experience_level is null or experience_level in ('beginner','novice','intermediate','advanced')),
  constraint coach_profiles_health_check check (health_status is null or health_status in ('ok','managed','needs_clearance'))
);

create table if not exists public.coach_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  goal_type text not null,
  current_weight_kg numeric(6,2) not null,
  target_weight_kg numeric(6,2),
  target_date date,
  gain_pace_preset text,
  target_bodyweight_pct_per_week numeric(6,3),
  days_per_week integer,
  weekdays integer[] not null default '{}',
  max_session_minutes integer,
  horizon_weeks integer,
  muscle_priorities jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint coach_goals_type_check check (goal_type in ('mass_gain','fat_loss','recomposition','strength','trail')),
  constraint coach_goals_pace_check check (gain_pace_preset is null or gain_pace_preset in ('controlled','normal','aggressive','custom')),
  constraint coach_goals_days_check check (days_per_week is null or days_per_week between 1 and 7),
  constraint coach_goals_horizon_check check (horizon_weeks is null or horizon_weeks between 1 and 104)
);

create index if not exists coach_goals_user_active_idx
  on public.coach_goals(user_id,active,updated_at desc);

create table if not exists public.coach_nutrition_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  goal_id uuid,
  effective_from date not null default current_date,
  calories_kcal integer not null,
  protein_g numeric(7,2) not null,
  carbs_g numeric(7,2) not null,
  fat_g numeric(7,2) not null,
  estimated_bmr_kcal integer,
  estimated_tdee_kcal integer,
  planned_surplus_kcal integer,
  target_bodyweight_pct_per_week numeric(6,3),
  target_kg_per_week numeric(7,3),
  calculation_method text not null,
  confidence text not null default 'estimated',
  source_inputs jsonb not null default '{}'::jsonb,
  adjustment jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint coach_nutrition_calories_check check (calories_kcal between 500 and 10000),
  constraint coach_nutrition_macros_check check (protein_g >= 0 and carbs_g >= 0 and fat_g >= 0),
  constraint coach_nutrition_confidence_check check (confidence in ('low','estimated','observed'))
);

create index if not exists coach_nutrition_user_active_idx
  on public.coach_nutrition_targets(user_id,active,effective_from desc);

create table if not exists public.coach_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  goal_id uuid,
  week_start date not null,
  average_weight_kg numeric(6,2),
  average_calories_kcal integer,
  adherence_pct numeric(6,2),
  sessions_completed integer,
  sessions_planned integer,
  average_steps integer,
  fatigue_score numeric(4,2),
  notes text,
  adjustment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  unique (user_id,week_start),
  constraint coach_checkins_adherence_check check (adherence_pct is null or adherence_pct between 0 and 100),
  constraint coach_checkins_fatigue_check check (fatigue_score is null or fatigue_score between 0 and 5)
);

create index if not exists coach_checkins_user_week_idx
  on public.coach_checkins(user_id,week_start desc);

alter table public.coach_profiles enable row level security;
alter table public.coach_goals enable row level security;
alter table public.coach_nutrition_targets enable row level security;
alter table public.coach_checkins enable row level security;

drop policy if exists "coach_profiles_owner_all" on public.coach_profiles;
create policy "coach_profiles_owner_all" on public.coach_profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_goals_owner_all" on public.coach_goals;
create policy "coach_goals_owner_all" on public.coach_goals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_nutrition_targets_owner_all" on public.coach_nutrition_targets;
create policy "coach_nutrition_targets_owner_all" on public.coach_nutrition_targets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_checkins_owner_all" on public.coach_checkins;
create policy "coach_checkins_owner_all" on public.coach_checkins
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
