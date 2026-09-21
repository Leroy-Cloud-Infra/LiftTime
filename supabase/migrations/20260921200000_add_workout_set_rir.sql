begin;

alter table public.workout_sets
  add column if not exists rir smallint null;

alter table public.workout_sets
  drop constraint if exists workout_sets_rir_allowed;

alter table public.workout_sets
  add constraint workout_sets_rir_allowed
  check (rir is null or rir between 0 and 5);

commit;
