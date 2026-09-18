begin;

create or replace function public.add_workout_exercise_with_defaults(
  p_session_id uuid,
  p_exercise_id uuid,
  p_user_id uuid
)
returns table (
  outcome text,
  workout_exercise_id uuid,
  session_id uuid,
  exercise_id uuid,
  order_index integer,
  superset_group_id uuid,
  created_at timestamptz,
  existing_workout_exercise_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_exercise public.exercises%rowtype;
  v_workout_exercise public.workout_exercises%rowtype;
  v_existing_workout_exercise_id uuid;
  v_next_order_index integer;
begin
  select *
  into v_session
  from public.workout_sessions
  where id = p_session_id
  for update;

  if not found or v_session.user_id <> p_user_id then
    return query
    select 'session_not_found_or_forbidden'::text, null::uuid, null::uuid, null::uuid, null::integer, null::uuid,
      null::timestamptz, null::uuid;
    return;
  end if;

  if v_session.status <> 'active' then
    return query
    select 'session_not_active'::text, null::uuid, v_session.id, null::uuid, null::integer, null::uuid,
      null::timestamptz, null::uuid;
    return;
  end if;

  select *
  into v_exercise
  from public.exercises
  where id = p_exercise_id
    and is_active = true;

  if not found then
    return query
    select 'exercise_not_found_or_inactive'::text, null::uuid, v_session.id, null::uuid, null::integer, null::uuid,
      null::timestamptz, null::uuid;
    return;
  end if;

  select id
  into v_existing_workout_exercise_id
  from public.workout_exercises
  where session_id = v_session.id
    and exercise_id = v_exercise.id
  limit 1;

  if found then
    return query
    select 'duplicate'::text, null::uuid, v_session.id, v_exercise.id, null::integer, null::uuid,
      null::timestamptz, v_existing_workout_exercise_id;
    return;
  end if;

  select coalesce(max(order_index), 0) + 1
  into v_next_order_index
  from public.workout_exercises
  where session_id = v_session.id;

  insert into public.workout_exercises (
    session_id,
    exercise_id,
    order_index,
    superset_group_id
  )
  values (
    v_session.id,
    v_exercise.id,
    v_next_order_index,
    null
  )
  returning * into v_workout_exercise;

  insert into public.workout_sets (
    workout_exercise_id,
    set_number,
    set_type,
    weight_lbs,
    reps,
    completed,
    completed_at
  )
  select
    v_workout_exercise.id,
    series.set_number,
    'working',
    null,
    v_exercise.default_reps,
    false,
    null
  from generate_series(1, v_exercise.default_sets) as series(set_number);

  return query
  select
    'created'::text,
    v_workout_exercise.id,
    v_workout_exercise.session_id,
    v_workout_exercise.exercise_id,
    v_workout_exercise.order_index,
    v_workout_exercise.superset_group_id,
    v_workout_exercise.created_at,
    null::uuid;
end;
$$;

revoke all on function public.add_workout_exercise_with_defaults(uuid, uuid, uuid) from public;
revoke all on function public.add_workout_exercise_with_defaults(uuid, uuid, uuid) from anon;
revoke all on function public.add_workout_exercise_with_defaults(uuid, uuid, uuid) from authenticated;
grant execute on function public.add_workout_exercise_with_defaults(uuid, uuid, uuid) to service_role;

commit;
