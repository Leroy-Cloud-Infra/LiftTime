begin;

create or replace function public.start_push_day_workout_session(p_user_id uuid)
returns table (
  outcome text,
  session_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_bench_press_exercise_id uuid;
  v_pull_up_exercise_id uuid;
  v_bicep_curl_exercise_id uuid;
  v_tricep_pushdown_exercise_id uuid;
  v_bench_press_workout_exercise_id uuid;
  v_pull_up_workout_exercise_id uuid;
  v_bicep_curl_workout_exercise_id uuid;
  v_tricep_pushdown_workout_exercise_id uuid;
  v_arms_superset_group_id uuid := gen_random_uuid();
begin
  select *
  into v_session
  from public.workout_sessions
  where user_id = p_user_id
    and status = 'active'
  for update;

  if found then
    return query select 'already_active'::text, v_session.id;
    return;
  end if;

  select id into v_bench_press_exercise_id from public.exercises where slug = 'bench-press' and is_active = true;
  select id into v_pull_up_exercise_id from public.exercises where slug = 'pull-up' and is_active = true;
  select id into v_bicep_curl_exercise_id from public.exercises where slug = 'bicep-curl' and is_active = true;
  select id into v_tricep_pushdown_exercise_id from public.exercises where slug = 'tricep-pushdown' and is_active = true;

  if v_bench_press_exercise_id is null or v_pull_up_exercise_id is null or v_bicep_curl_exercise_id is null or v_tricep_pushdown_exercise_id is null then
    raise exception 'Required active starter exercise is missing';
  end if;

  begin
    insert into public.workout_sessions (user_id, name, status)
    values (p_user_id, 'Push Day', 'active')
    returning * into v_session;
  exception
    when unique_violation then
      select *
      into v_session
      from public.workout_sessions
      where user_id = p_user_id
        and status = 'active';

      if not found then
        raise;
      end if;

      return query select 'already_active'::text, v_session.id;
      return;
  end;

  insert into public.workout_exercises (session_id, exercise_id, order_index, superset_group_id)
  values (v_session.id, v_bench_press_exercise_id, 1, null)
  returning id into v_bench_press_workout_exercise_id;

  insert into public.workout_exercises (session_id, exercise_id, order_index, superset_group_id)
  values (v_session.id, v_pull_up_exercise_id, 2, null)
  returning id into v_pull_up_workout_exercise_id;

  insert into public.workout_exercises (session_id, exercise_id, order_index, superset_group_id)
  values (v_session.id, v_bicep_curl_exercise_id, 3, v_arms_superset_group_id)
  returning id into v_bicep_curl_workout_exercise_id;

  insert into public.workout_exercises (session_id, exercise_id, order_index, superset_group_id)
  values (v_session.id, v_tricep_pushdown_exercise_id, 4, v_arms_superset_group_id)
  returning id into v_tricep_pushdown_workout_exercise_id;

  insert into public.workout_sets (
    workout_exercise_id,
    set_number,
    set_type,
    weight_lbs,
    reps,
    completed,
    completed_at
  )
  values
    (v_bench_press_workout_exercise_id, 1, 'warmup', 135, 10, false, null),
    (v_bench_press_workout_exercise_id, 2, 'working', 140, 10, false, null),
    (v_bench_press_workout_exercise_id, 3, 'working', 140, 10, false, null),
    (v_pull_up_workout_exercise_id, 1, 'working', 15, 8, false, null),
    (v_pull_up_workout_exercise_id, 2, 'working', 15, 8, false, null),
    (v_pull_up_workout_exercise_id, 3, 'working', 15, 8, false, null),
    (v_bicep_curl_workout_exercise_id, 1, 'working', 35, 12, false, null),
    (v_bicep_curl_workout_exercise_id, 2, 'working', 35, 12, false, null),
    (v_bicep_curl_workout_exercise_id, 3, 'working', 35, 12, false, null),
    (v_tricep_pushdown_workout_exercise_id, 1, 'working', 50, 12, false, null),
    (v_tricep_pushdown_workout_exercise_id, 2, 'working', 50, 12, false, null),
    (v_tricep_pushdown_workout_exercise_id, 3, 'working', 50, 12, false, null);

  return query select 'created'::text, v_session.id;
end;
$$;

revoke all on function public.start_push_day_workout_session(uuid) from public;
revoke all on function public.start_push_day_workout_session(uuid) from anon;
revoke all on function public.start_push_day_workout_session(uuid) from authenticated;
grant execute on function public.start_push_day_workout_session(uuid) to service_role;

commit;
