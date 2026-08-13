alter type game_phase add value if not exists 'DAY_CONCLUSION' before 'DAY_VOTING';

alter table public.room_players add column if not exists is_bot boolean not null default false;
alter table public.room_players add column if not exists bot_name text;
alter table public.room_players add column if not exists bot_avatar text;
alter table public.room_players add column if not exists wants_vote boolean not null default false;

create or replace function public.get_room_state(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v_room rooms; v_me room_players; v_state jsonb; v_speaker uuid;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.id is null then raise exception 'Room not found'; end if;
  select * into v_me from room_players where room_id = p_room_id and user_id = auth.uid();
  if v_me.id is null then raise exception 'Not a member of this room'; end if;

  select user_id into v_speaker from (
    select user_id, row_number() over (order by created_at) - 1 as idx
    from room_players where room_id = p_room_id and is_alive) t
  where idx = v_room.speaker_index;

  select jsonb_build_object(
    'room', to_jsonb(v_room),
    'speaker_id', v_speaker,
    'living_count', (select count(*) from room_players where room_id = p_room_id and is_alive),
    'wants_vote_count', (select count(*) from room_players where room_id = p_room_id and is_alive and wants_vote),
    'me', jsonb_build_object(
      'user_id', v_me.user_id, 'role', v_me.role, 'is_alive', v_me.is_alive,
      'is_ready', v_me.is_ready, 'card_seen', v_me.card_seen, 'self_heal_used', v_me.self_heal_used,
      'wants_vote', v_me.wants_vote,
      'is_host', v_room.host_id = auth.uid()),
    'night', (select jsonb_build_object(
        'wolf_target', case when v_me.role = 'WOLF' then na.wolf_target_user_id end,
        'detective_target', case when v_me.role = 'DETECTIVE' then na.detective_target_user_id end,
        'doctor_target', case when v_me.role = 'DOCTOR' then na.doctor_target_user_id end)
      from night_actions na where na.room_id = p_room_id and na.round_number = v_room.round_number),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('voter_id', v.voter_id, 'target_id', v.target_id)), '[]'::jsonb)
      from votes v where v.room_id = p_room_id and v.round_number = v_room.round_number),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', rp.user_id,
        'username', coalesce(p.username, rp.bot_name, 'BOT'),
        'avatar_url', coalesce(p.avatar_url, rp.bot_avatar),
        'is_ready', rp.is_ready, 'is_alive', rp.is_alive, 'card_seen', rp.card_seen,
        'is_bot', rp.is_bot, 'wants_vote', rp.wants_vote,
        'is_host', rp.user_id = v_room.host_id,
        'role', case
          when rp.user_id = auth.uid() or not rp.is_alive or v_room.status = 'FINISHED'
            or (v_me.role = 'WOLF' and rp.role = 'WOLF') then rp.role::text
          else null end
      ) order by rp.created_at), '[]'::jsonb)
      from room_players rp left join profiles p on p.id = rp.user_id where rp.room_id = p_room_id)
  ) into v_state;
  return v_state;
end; $function$;

create or replace function public.add_bots(p_room_id uuid, p_count integer)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms; v_i int; v_total int; v_name text;
  v_names text[] := array['NOVA','RIGEL','ORION','ZETA','VEGA','ATLAS','LYRA','CASSI','DRACO','MIRA','PAVO','JUNO'];
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can add bots'; end if;
  if v_room.status <> 'LOBBY' then raise exception 'Game already started'; end if;
  select count(*) into v_total from room_players where room_id = p_room_id;
  for v_i in 1 .. greatest(p_count, 0) loop
    exit when v_total >= 15;
    v_total := v_total + 1;
    v_name := 'BOT ' || v_names[1 + ((v_total * 7) % array_length(v_names, 1))] || ' ' || v_total;
    insert into room_players (room_id, user_id, is_bot, bot_name, bot_avatar, is_ready)
    values (p_room_id, gen_random_uuid(), true, v_name,
      'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=' || v_name || '&backgroundColor=1f1f22', true);
  end loop;
end; $function$;

create or replace function public.remove_bots(p_room_id uuid, p_count integer)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can remove bots'; end if;
  if v_room.status <> 'LOBBY' then raise exception 'Game already started'; end if;
  delete from room_players where id in (
    select id from room_players where room_id = p_room_id and is_bot
    order by created_at desc limit greatest(p_count, 0));
end; $function$;

create or replace function public.start_game(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms; v_total int; v_w int; v_d int; v_dt int; v_ids uuid[]; v_i int := 1;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.status <> 'LOBBY' then return; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  select count(*) into v_total from room_players where room_id = p_room_id;
  if v_total < 6 or v_total > 15 then raise exception 'Need between 6 and 15 players'; end if;
  if exists (select 1 from room_players where room_id = p_room_id and not is_ready) then
    raise exception 'All players must be ready';
  end if;
  select wolves, doctors, detectives into v_w, v_d, v_dt from public.role_counts(v_total);
  select array_agg(user_id order by random()) into v_ids from room_players where room_id = p_room_id;
  update room_players set role = 'CIVILIAN', is_alive = true, card_seen = is_bot,
    self_heal_used = false, wants_vote = false where room_id = p_room_id;
  for v_i in 1 .. v_w loop
    update room_players set role = 'WOLF' where room_id = p_room_id and user_id = v_ids[v_i];
  end loop;
  for v_i in v_w + 1 .. v_w + v_d loop
    update room_players set role = 'DOCTOR' where room_id = p_room_id and user_id = v_ids[v_i];
  end loop;
  for v_i in v_w + v_d + 1 .. v_w + v_d + v_dt loop
    update room_players set role = 'DETECTIVE' where room_id = p_room_id and user_id = v_ids[v_i];
  end loop;
  update rooms set status = 'IN_PROGRESS', current_phase = 'ROLE_DISTRIBUTION',
    round_number = 1, phase_ends_at = null, speaker_index = 0 where id = p_room_id;
  insert into messages (room_id, sender_id, channel, content)
    values (p_room_id, null, 'GLOBAL', 'The night falls. Roles have been distributed.');
end; $function$;

create or replace function public.open_voting(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  update rooms set current_phase = 'DAY_VOTING', phase_ends_at = now() + interval '60 seconds'
    where id = p_room_id and current_phase in ('DAY_CONCLUSION','DAY_DISCUSSION');
  insert into messages (room_id, sender_id, channel, content)
    values (p_room_id, null, 'GLOBAL', 'VOTING IS OPEN. YOU HAVE ONE MINUTE.');
end; $function$;

create or replace function public.ready_to_vote(p_room_id uuid, p_ready boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms; v_living int; v_want int;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.current_phase not in ('DAY_CONCLUSION','DAY_DISCUSSION') then return; end if;
  update room_players set wants_vote = p_ready
    where room_id = p_room_id and user_id = auth.uid() and is_alive;
  select count(*), count(*) filter (where wants_vote) into v_living, v_want
    from room_players where room_id = p_room_id and is_alive;
  if v_want * 2 > v_living then perform public.open_voting(p_room_id); end if;
end; $function$;

create or replace function public.tick_room(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms; v_living int; v_has boolean;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.status <> 'IN_PROGRESS' or v_room.phase_ends_at is null then return; end if;
  if v_room.phase_ends_at > now() then return; end if;

  if v_room.current_phase = 'NIGHT_WOLVES' then
    select exists (select 1 from room_players where room_id = p_room_id and is_alive and role = 'DETECTIVE') into v_has;
    if v_has then
      update rooms set current_phase = 'NIGHT_DETECTIVE', phase_ends_at = now() + interval '30 seconds' where id = p_room_id;
      return;
    end if;
    v_room.current_phase := 'NIGHT_DETECTIVE';
  end if;

  if v_room.current_phase = 'NIGHT_DETECTIVE' then
    select exists (select 1 from room_players where room_id = p_room_id and is_alive and role = 'DOCTOR') into v_has;
    if v_has then
      update rooms set current_phase = 'NIGHT_DOCTOR', phase_ends_at = now() + interval '30 seconds' where id = p_room_id;
      return;
    end if;
    perform public.resolve_night(p_room_id);
    return;
  end if;

  if v_room.current_phase = 'NIGHT_DOCTOR' then
    perform public.resolve_night(p_room_id);
    return;
  end if;

  if v_room.current_phase = 'NIGHT_RESULT' then
    if public.check_win(p_room_id) is not null then
      perform public.finish_or_next_night(p_room_id);
    else
      update room_players set wants_vote = false where room_id = p_room_id;
      update rooms set current_phase = 'DAY_DISCUSSION', speaker_index = 0,
        phase_ends_at = now() + interval '60 seconds' where id = p_room_id;
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, null, 'GLOBAL', 'DAY ' || v_room.round_number || ': EACH LIVING PLAYER HAS ONE MINUTE TO SPEAK.');
    end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_DISCUSSION' then
    select count(*) into v_living from room_players where room_id = p_room_id and is_alive;
    if v_room.speaker_index + 1 >= v_living then
      update rooms set current_phase = 'DAY_CONCLUSION', phase_ends_at = now() + interval '5 minutes' where id = p_room_id;
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, null, 'GLOBAL', 'OPEN DISCUSSION. THE VOTE OPENS WHEN THE MAJORITY IS READY.');
    else
      update rooms set speaker_index = v_room.speaker_index + 1,
        phase_ends_at = now() + interval '60 seconds' where id = p_room_id;
    end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_CONCLUSION' then
    perform public.open_voting(p_room_id);
    return;
  end if;

  if v_room.current_phase = 'DAY_VOTING' then
    perform public.resolve_votes(p_room_id);
    return;
  end if;
end; $function$;

create or replace function public.run_bots(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_room rooms; v_t uuid; v_speaker room_players; v_living int; v_want int;
  v_lines text[] := array[
    'I have a bad feeling about the quiet ones.',
    'Nothing suspicious from my side last night.',
    'Whoever pushed the vote first is usually hiding something.',
    'I am town. Let us not waste a day.',
    'Watch who defends who too fast.',
    'I would rather vote than sit here silent.'];
  v_b record;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.id is null or v_room.status <> 'IN_PROGRESS' then return; end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = auth.uid()) then return; end if;

  if v_room.current_phase = 'NIGHT_WOLVES' then
    if exists (select 1 from room_players where room_id = p_room_id and is_alive and is_bot and role = 'WOLF')
       and (select wolf_target_user_id from night_actions where room_id = p_room_id and round_number = v_room.round_number) is null
       and not exists (select 1 from room_players where room_id = p_room_id and is_alive and not is_bot and role = 'WOLF') then
      select user_id into v_t from room_players
        where room_id = p_room_id and is_alive and role <> 'WOLF' order by random() limit 1;
      update night_actions set wolf_target_user_id = v_t
        where room_id = p_room_id and round_number = v_room.round_number;
      update rooms set phase_ends_at = least(phase_ends_at, now() + interval '2 seconds') where id = p_room_id;
    end if;
    return;
  end if;

  if v_room.current_phase = 'NIGHT_DETECTIVE' then
    if exists (select 1 from room_players where room_id = p_room_id and is_alive and is_bot and role = 'DETECTIVE')
       and (select detective_target_user_id from night_actions where room_id = p_room_id and round_number = v_room.round_number) is null
       and not exists (select 1 from room_players where room_id = p_room_id and is_alive and not is_bot and role = 'DETECTIVE') then
      select user_id into v_t from room_players
        where room_id = p_room_id and is_alive and not is_bot order by random() limit 1;
      update night_actions set detective_target_user_id = v_t
        where room_id = p_room_id and round_number = v_room.round_number;
      update rooms set phase_ends_at = least(phase_ends_at, now() + interval '2 seconds') where id = p_room_id;
    end if;
    return;
  end if;

  if v_room.current_phase = 'NIGHT_DOCTOR' then
    if exists (select 1 from room_players where room_id = p_room_id and is_alive and is_bot and role = 'DOCTOR')
       and (select doctor_target_user_id from night_actions where room_id = p_room_id and round_number = v_room.round_number) is null
       and not exists (select 1 from room_players where room_id = p_room_id and is_alive and not is_bot and role = 'DOCTOR') then
      select user_id into v_t from room_players
        where room_id = p_room_id and is_alive order by random() limit 1;
      update night_actions set doctor_target_user_id = v_t
        where room_id = p_room_id and round_number = v_room.round_number;
      update rooms set phase_ends_at = least(phase_ends_at, now() + interval '2 seconds') where id = p_room_id;
    end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_DISCUSSION' then
    select rp.* into v_speaker from (
      select user_id, row_number() over (order by created_at) - 1 as idx
      from room_players where room_id = p_room_id and is_alive) t
      join room_players rp on rp.room_id = p_room_id and rp.user_id = t.user_id
    where t.idx = v_room.speaker_index;
    if v_speaker.is_bot then
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, v_speaker.user_id, 'GLOBAL',
          v_lines[1 + floor(random() * array_length(v_lines, 1))::int]);
      update rooms set phase_ends_at = now() - interval '1 second' where id = p_room_id;
      perform public.tick_room(p_room_id);
    end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_CONCLUSION' then
    update room_players set wants_vote = true
      where room_id = p_room_id and is_alive and is_bot and not wants_vote;
    select count(*), count(*) filter (where wants_vote) into v_living, v_want
      from room_players where room_id = p_room_id and is_alive;
    if v_want * 2 > v_living then perform public.open_voting(p_room_id); end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_VOTING' then
    for v_b in select * from room_players
      where room_id = p_room_id and is_alive and is_bot
        and not exists (select 1 from votes v where v.room_id = p_room_id
          and v.round_number = v_room.round_number and v.voter_id = room_players.user_id)
    loop
      select user_id into v_t from room_players
        where room_id = p_room_id and is_alive and user_id <> v_b.user_id
          and (v_b.role <> 'WOLF' or role <> 'WOLF')
        order by random() limit 1;
      if v_t is not null then
        insert into votes (room_id, round_number, voter_id, target_id)
          values (p_room_id, v_room.round_number, v_b.user_id, v_t)
          on conflict (room_id, round_number, voter_id) do nothing;
      end if;
    end loop;
    if not exists (
      select 1 from room_players rp where rp.room_id = p_room_id and rp.is_alive
        and not exists (select 1 from votes v where v.room_id = p_room_id
          and v.round_number = v_room.round_number and v.voter_id = rp.user_id)) then
      update rooms set phase_ends_at = least(phase_ends_at, now() + interval '2 seconds') where id = p_room_id;
    end if;
    return;
  end if;
end; $function$;

revoke all on function public.add_bots(uuid, integer) from public;
revoke all on function public.remove_bots(uuid, integer) from public;
revoke all on function public.ready_to_vote(uuid, boolean) from public;
revoke all on function public.run_bots(uuid) from public;
revoke all on function public.open_voting(uuid) from public;
grant execute on function public.add_bots(uuid, integer) to authenticated;
grant execute on function public.remove_bots(uuid, integer) to authenticated;
grant execute on function public.ready_to_vote(uuid, boolean) to authenticated;
grant execute on function public.run_bots(uuid) to authenticated;