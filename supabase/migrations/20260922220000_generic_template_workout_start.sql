begin;

create function public.start_workout_session_from_template(p_user_id uuid, p_template_id uuid)
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
  v_template public.workout_templates%rowtype;
  v_template_exercise record;
  v_workout_exercise_id uuid;
  v_group_ids uuid[] := array[]::uuid[];
  v_session_group_ids uuid[] := array[]::uuid[];
  v_group_position integer;
  v_session_group_id uuid;
  v_inserted_set_count integer;
begin
  -- Serialize starts for this principal before checking the active-session index.
  perform 1 from auth.users as principal where principal.id = p_user_id for update;
  if not found then
    raise exception 'Workout principal does not exist';
  end if;

  select ws.* into v_session
  from public.workout_sessions as ws
  where ws.user_id = p_user_id and ws.status = 'active';

  if found then
    return query select 'already_active'::text, v_session.id;
    return;
  end if;

  select template.* into v_template
  from public.workout_templates as template
  where template.id = p_template_id;

  if not found then
    return query select 'template_not_found'::text, null::uuid;
    return;
  end if;

  if not v_template.is_active then
    return query select 'template_inactive'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1 from public.workout_template_exercises as template_exercise
    where template_exercise.workout_template_id = p_template_id
  ) or exists (
    select 1
    from public.workout_template_exercises as template_exercise
    left join public.exercises as catalog on catalog.id = template_exercise.exercise_id
    where template_exercise.workout_template_id = p_template_id
      and (
        catalog.id is null
        or not catalog.is_active
        or not exists (
          select 1 from public.workout_template_sets as template_set
          where template_set.workout_template_exercise_id = template_exercise.id
        )
      )
  ) then
    return query select 'template_invalid'::text, null::uuid;
    return;
  end if;

  insert into public.workout_sessions (user_id, name, status)
  values (p_user_id, v_template.name, 'active')
  returning * into v_session;

  for v_template_exercise in
    select template_exercise.*
    from public.workout_template_exercises as template_exercise
    where template_exercise.workout_template_id = p_template_id
    order by template_exercise.order_index, template_exercise.id
  loop
    v_session_group_id := null;
    if v_template_exercise.superset_group_id is not null then
      v_group_position := array_position(v_group_ids, v_template_exercise.superset_group_id);
      if v_group_position is null then
        v_session_group_id := gen_random_uuid();
        v_group_ids := array_append(v_group_ids, v_template_exercise.superset_group_id);
        v_session_group_ids := array_append(v_session_group_ids, v_session_group_id);
      else
        v_session_group_id := v_session_group_ids[v_group_position];
      end if;
    end if;

    insert into public.workout_exercises (session_id, exercise_id, order_index, superset_group_id)
    values (v_session.id, v_template_exercise.exercise_id, v_template_exercise.order_index, v_session_group_id)
    returning id into v_workout_exercise_id;

    insert into public.workout_sets (
      workout_exercise_id, set_number, set_type, weight_lbs, reps, rir, completed, completed_at
    )
    select
      v_workout_exercise_id, template_set.set_number, template_set.set_type,
      template_set.planned_weight_lbs, template_set.target_reps, null, false, null
    from public.workout_template_sets as template_set
    where template_set.workout_template_exercise_id = v_template_exercise.id
    order by template_set.set_number;

    get diagnostics v_inserted_set_count = row_count;
    if v_inserted_set_count = 0 then
      raise exception 'Template exercise lost its planned sets during workout start';
    end if;
  end loop;

  return query select 'created'::text, v_session.id;
end;
$$;

revoke all on function public.start_workout_session_from_template(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_workout_session_from_template(uuid, uuid) to service_role;

-- Preserve the deployed RPC contract during rollout without retaining a second initializer.
create or replace function public.start_push_day_workout_session(p_user_id uuid)
returns table (
  outcome text,
  session_id uuid
)
language sql
security definer
set search_path = public
as $$
  select result.outcome, result.session_id
  from public.start_workout_session_from_template(
    p_user_id, '79000000-0000-4000-8000-000000000001'::uuid
  ) as result;
$$;

revoke all on function public.start_push_day_workout_session(uuid) from public, anon, authenticated;
grant execute on function public.start_push_day_workout_session(uuid) to service_role;

commit;
