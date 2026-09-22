begin;

create extension if not exists pgcrypto;

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),

  constraint workout_templates_name_not_blank
    check (length(btrim(name)) > 0)
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index integer not null,
  superset_group_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint workout_template_exercises_order_positive
    check (order_index > 0),
  constraint workout_template_exercises_template_order_unique
    unique (workout_template_id, order_index)
);

create index workout_template_exercises_exercise_id_idx
  on public.workout_template_exercises (exercise_id);

create table public.workout_template_sets (
  id uuid primary key default gen_random_uuid(),
  workout_template_exercise_id uuid not null references public.workout_template_exercises(id) on delete cascade,
  set_number integer not null,
  set_type text not null default 'working',
  target_reps integer not null,
  planned_weight_lbs numeric(6,2) null,
  created_at timestamptz not null default timezone('utc', now()),

  constraint workout_template_sets_number_positive
    check (set_number > 0),
  constraint workout_template_sets_type_allowed
    check (set_type in ('working', 'warmup', 'drop', 'failure')),
  constraint workout_template_sets_target_reps_positive
    check (target_reps > 0),
  constraint workout_template_sets_planned_weight_non_negative
    check (planned_weight_lbs is null or planned_weight_lbs >= 0),
  constraint workout_template_sets_exercise_number_unique
    unique (workout_template_exercise_id, set_number)
);

create index workout_template_sets_exercise_number_idx
  on public.workout_template_sets (workout_template_exercise_id, set_number);

alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_template_sets enable row level security;

revoke all on table public.workout_templates from public, anon, authenticated;
revoke all on table public.workout_template_exercises from public, anon, authenticated;
revoke all on table public.workout_template_sets from public, anon, authenticated;

grant select, insert, update, delete on table public.workout_templates to service_role;
grant select, insert, update, delete on table public.workout_template_exercises to service_role;
grant select, insert, update, delete on table public.workout_template_sets to service_role;

do $$
declare
  v_active_starter_count integer;
begin
  select count(*)
  into v_active_starter_count
  from public.exercises
  where is_active = true
    and slug in ('bench-press', 'pull-up', 'bicep-curl', 'tricep-pushdown');

  if v_active_starter_count <> 4 then
    raise exception 'Expected four active Push Day catalog exercises, found %', v_active_starter_count;
  end if;
end;
$$;

insert into public.workout_templates (id, name, is_active)
values ('79000000-0000-4000-8000-000000000001', 'Push Day', true)
on conflict (id) do nothing;

insert into public.workout_template_exercises (
  id,
  workout_template_id,
  exercise_id,
  order_index,
  superset_group_id
)
select
  seed.id,
  '79000000-0000-4000-8000-000000000001'::uuid,
  exercise.id,
  seed.order_index,
  seed.superset_group_id
from (
  values
    ('79000000-0000-4000-8001-000000000001'::uuid, 'bench-press'::text, 1, null::uuid),
    ('79000000-0000-4000-8001-000000000002'::uuid, 'pull-up'::text, 2, null::uuid),
    ('79000000-0000-4000-8001-000000000003'::uuid, 'bicep-curl'::text, 3, '79000000-0000-4000-8000-000000000100'::uuid),
    ('79000000-0000-4000-8001-000000000004'::uuid, 'tricep-pushdown'::text, 4, '79000000-0000-4000-8000-000000000100'::uuid)
) as seed(id, slug, order_index, superset_group_id)
join public.exercises as exercise
  on exercise.slug = seed.slug
 and exercise.is_active = true
on conflict (id) do nothing;

insert into public.workout_template_sets (
  id,
  workout_template_exercise_id,
  set_number,
  set_type,
  target_reps,
  planned_weight_lbs
)
values
  ('79000000-0000-4000-8002-000000000001', '79000000-0000-4000-8001-000000000001', 1, 'warmup', 10, 135),
  ('79000000-0000-4000-8002-000000000002', '79000000-0000-4000-8001-000000000001', 2, 'working', 10, 140),
  ('79000000-0000-4000-8002-000000000003', '79000000-0000-4000-8001-000000000001', 3, 'working', 10, 140),
  ('79000000-0000-4000-8002-000000000004', '79000000-0000-4000-8001-000000000002', 1, 'working', 8, 15),
  ('79000000-0000-4000-8002-000000000005', '79000000-0000-4000-8001-000000000002', 2, 'working', 8, 15),
  ('79000000-0000-4000-8002-000000000006', '79000000-0000-4000-8001-000000000002', 3, 'working', 8, 15),
  ('79000000-0000-4000-8002-000000000007', '79000000-0000-4000-8001-000000000003', 1, 'working', 12, 35),
  ('79000000-0000-4000-8002-000000000008', '79000000-0000-4000-8001-000000000003', 2, 'working', 12, 35),
  ('79000000-0000-4000-8002-000000000009', '79000000-0000-4000-8001-000000000003', 3, 'working', 12, 35),
  ('79000000-0000-4000-8002-000000000010', '79000000-0000-4000-8001-000000000004', 1, 'working', 12, 50),
  ('79000000-0000-4000-8002-000000000011', '79000000-0000-4000-8001-000000000004', 2, 'working', 12, 50),
  ('79000000-0000-4000-8002-000000000012', '79000000-0000-4000-8001-000000000004', 3, 'working', 12, 50)
on conflict (id) do nothing;

commit;
