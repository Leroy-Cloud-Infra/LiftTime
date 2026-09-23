begin;

insert into public.exercises (
  id, name, slug, muscle_groups, secondary_muscles, equipment,
  category, mechanic, force, difficulty, tracking_type, progression_model,
  default_sets, default_reps, rep_range_min, rep_range_max,
  increment_lbs, is_bodyweight, is_unilateral, instructions
)
values
  (
    '8a000000-0000-4000-8000-000000000001', 'Incline Dumbbell Press', 'incline-dumbbell-press',
    array['chest'], array['shoulders','triceps'], array['dumbbell','bench'],
    'compound', 'push', 'push', 'beginner', 'weight_reps', 'none',
    3, 10, 8, 12, 5, false, false,
    array['Press dumbbells from an incline bench with control.']
  ),
  (
    '8a000000-0000-4000-8000-000000000002', 'Lat Pulldown', 'lat-pulldown',
    array['back'], array['biceps','forearms'], array['cable'],
    'compound', 'pull', 'pull', 'beginner', 'weight_reps', 'none',
    3, 10, 8, 12, 5, false, false,
    array['Pull the bar toward your upper chest and return with control.']
  ),
  (
    '8a000000-0000-4000-8000-000000000003', 'Machine Shoulder Press', 'machine-shoulder-press',
    array['shoulders'], array['triceps'], array['machine'],
    'compound', 'push', 'push', 'beginner', 'weight_reps', 'none',
    3, 10, 8, 12, 5, false, false,
    array['Press the machine handles overhead with control.']
  ),
  (
    '8a000000-0000-4000-8000-000000000004', 'Seated Cable Row', 'seated-cable-row',
    array['back'], array['biceps','forearms'], array['cable'],
    'compound', 'pull', 'pull', 'beginner', 'weight_reps', 'none',
    3, 10, 8, 12, 5, false, false,
    array['Pull the handle toward your torso and return with control.']
  ),
  (
    '8a000000-0000-4000-8000-000000000005', 'Machine Lateral Raise', 'machine-lateral-raise',
    array['shoulders'], '{}'::text[], array['machine'],
    'isolation', 'push', 'push', 'beginner', 'weight_reps', 'none',
    3, 12, 10, 15, 5, false, false,
    array['Raise the machine arms to shoulder height with control.']
  );

do $$
declare
  v_catalog_count integer;
begin
  select count(*) into v_catalog_count
  from public.exercises
  where is_active = true
    and slug in (
      'incline-dumbbell-press', 'lat-pulldown', 'machine-shoulder-press',
      'seated-cable-row', 'machine-lateral-raise',
      'plate-loaded-preacher-curl', 'tricep-pushdown'
    );

  if v_catalog_count <> 7 then
    raise exception 'Upper Body requires seven active catalog exercises, found %', v_catalog_count;
  end if;
end;
$$;

insert into public.workout_templates (id, name, is_active)
values ('79000000-0000-4000-8000-000000000002', 'Upper Body', true);

insert into public.workout_template_exercises (
  id, workout_template_id, exercise_id, order_index, superset_group_id
)
select
  seed.id,
  '79000000-0000-4000-8000-000000000002'::uuid,
  catalog.id,
  seed.order_index,
  null::uuid
from (
  values
    ('79000000-0000-4000-8001-000000000005'::uuid, 'incline-dumbbell-press'::text, 1),
    ('79000000-0000-4000-8001-000000000006'::uuid, 'lat-pulldown'::text, 2),
    ('79000000-0000-4000-8001-000000000007'::uuid, 'machine-shoulder-press'::text, 3),
    ('79000000-0000-4000-8001-000000000008'::uuid, 'seated-cable-row'::text, 4),
    ('79000000-0000-4000-8001-000000000009'::uuid, 'machine-lateral-raise'::text, 5),
    ('79000000-0000-4000-8001-000000000010'::uuid, 'plate-loaded-preacher-curl'::text, 6),
    ('79000000-0000-4000-8001-000000000011'::uuid, 'tricep-pushdown'::text, 7)
) as seed(id, slug, order_index)
join public.exercises as catalog on catalog.slug = seed.slug and catalog.is_active = true;

insert into public.workout_template_sets (
  workout_template_exercise_id, set_number, set_type, target_reps, planned_weight_lbs
)
select prescription.exercise_id, set_numbers.set_number, 'working', prescription.reps, null::numeric
from (
  values
    ('79000000-0000-4000-8001-000000000005'::uuid, 10),
    ('79000000-0000-4000-8001-000000000006'::uuid, 10),
    ('79000000-0000-4000-8001-000000000007'::uuid, 10),
    ('79000000-0000-4000-8001-000000000008'::uuid, 10),
    ('79000000-0000-4000-8001-000000000009'::uuid, 12),
    ('79000000-0000-4000-8001-000000000010'::uuid, 10),
    ('79000000-0000-4000-8001-000000000011'::uuid, 10)
) as prescription(exercise_id, reps)
cross join generate_series(1, 3) as set_numbers(set_number);

commit;
