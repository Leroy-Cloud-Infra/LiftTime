begin;

create or replace function public.delete_workout_set_and_compact(
  p_user_id uuid,
  p_workout_exercise_id uuid,
  p_set_id uuid
)
returns table (outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_set public.workout_sets%rowtype;
  v_remaining_set record;
  v_next_set_number integer := 1;
begin
  select session.*
  into v_session
  from public.workout_sessions as session
  join public.workout_exercises as workout_exercise
    on workout_exercise.session_id = session.id
  where workout_exercise.id = p_workout_exercise_id
  for update of session;

  if not found or v_session.user_id <> p_user_id then
    return query select 'not_found_or_forbidden'::text;
    return;
  end if;

  if v_session.status <> 'active' then
    return query select 'session_not_active'::text;
    return;
  end if;

  select workout_set.*
  into v_set
  from public.workout_sets as workout_set
  where workout_set.id = p_set_id
    and workout_set.workout_exercise_id = p_workout_exercise_id
  for update;

  if not found then
    return query select 'set_not_found'::text;
    return;
  end if;

  delete from public.workout_sets
  where id = v_set.id;

  for v_remaining_set in
    select workout_set.id, workout_set.set_number
    from public.workout_sets as workout_set
    where workout_set.workout_exercise_id = p_workout_exercise_id
    order by workout_set.set_number, workout_set.id
    for update
  loop
    if v_remaining_set.set_number <> v_next_set_number then
      update public.workout_sets
      set set_number = v_next_set_number
      where id = v_remaining_set.id;
    end if;

    v_next_set_number := v_next_set_number + 1;
  end loop;

  return query select 'deleted'::text;
end;
$$;

revoke all on function public.delete_workout_set_and_compact(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_workout_set_and_compact(uuid, uuid, uuid) to service_role;

create or replace function public.delete_workout_exercises_and_compact(
  p_user_id uuid,
  p_session_id uuid,
  p_workout_exercise_ids uuid[]
)
returns table (
  outcome text,
  deleted_workout_exercise_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_requested_ids uuid[];
  v_existing_count integer;
  v_completed_set_count integer;
  v_remaining_exercise record;
  v_next_order_index integer := 1;
begin
  select array_agg(distinct requested_id order by requested_id)
  into v_requested_ids
  from unnest(p_workout_exercise_ids) as requested(requested_id)
  where requested_id is not null;

  if coalesce(array_length(v_requested_ids, 1), 0) = 0 then
    return query select 'invalid_input'::text, array[]::uuid[];
    return;
  end if;

  select session.*
  into v_session
  from public.workout_sessions as session
  where session.id = p_session_id
  for update;

  if not found or v_session.user_id <> p_user_id then
    return query select 'not_found_or_forbidden'::text, array[]::uuid[];
    return;
  end if;

  if v_session.status <> 'active' then
    return query select 'session_not_active'::text, array[]::uuid[];
    return;
  end if;

  select count(*)
  into v_existing_count
  from public.workout_exercises as workout_exercise
  where workout_exercise.session_id = p_session_id
    and workout_exercise.id = any(v_requested_ids);

  if v_existing_count <> array_length(v_requested_ids, 1) then
    return query select 'exercise_not_found'::text, array[]::uuid[];
    return;
  end if;

  perform 1
  from public.workout_exercises as workout_exercise
  where workout_exercise.session_id = p_session_id
    and workout_exercise.id = any(v_requested_ids)
  for update;

  -- Serialize against concurrent set completion before enforcing the deletion guard.
  perform 1
  from public.workout_sets as workout_set
  where workout_set.workout_exercise_id = any(v_requested_ids)
  for update;

  select count(*)
  into v_completed_set_count
  from public.workout_sets as workout_set
  where workout_set.workout_exercise_id = any(v_requested_ids)
    and workout_set.completed = true;

  if v_completed_set_count > 0 then
    return query select 'exercise_has_completed_sets'::text, array[]::uuid[];
    return;
  end if;

  delete from public.workout_exercises as workout_exercise
  where workout_exercise.session_id = p_session_id
    and workout_exercise.id = any(v_requested_ids);

  -- A single remaining member is no longer a truthful superset.
  update public.workout_exercises as workout_exercise
  set superset_group_id = null
  where workout_exercise.session_id = p_session_id
    and workout_exercise.superset_group_id is not null
    and (
      select count(*)
      from public.workout_exercises as grouped_exercise
      where grouped_exercise.session_id = p_session_id
        and grouped_exercise.superset_group_id = workout_exercise.superset_group_id
    ) < 2;

  for v_remaining_exercise in
    select workout_exercise.id, workout_exercise.order_index
    from public.workout_exercises as workout_exercise
    where workout_exercise.session_id = p_session_id
    order by workout_exercise.order_index, workout_exercise.id
    for update
  loop
    if v_remaining_exercise.order_index <> v_next_order_index then
      update public.workout_exercises
      set order_index = v_next_order_index
      where id = v_remaining_exercise.id;
    end if;

    v_next_order_index := v_next_order_index + 1;
  end loop;

  return query select 'deleted'::text, v_requested_ids;
end;
$$;

revoke all on function public.delete_workout_exercises_and_compact(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.delete_workout_exercises_and_compact(uuid, uuid, uuid[]) to service_role;

commit;
