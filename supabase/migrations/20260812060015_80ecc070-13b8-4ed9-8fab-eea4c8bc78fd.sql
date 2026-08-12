
create type public.room_status as enum ('LOBBY','IN_PROGRESS','FINISHED');
create type public.game_phase as enum ('ROLE_DISTRIBUTION','NIGHT_WOLVES','NIGHT_DETECTIVE','NIGHT_DOCTOR','NIGHT_RESULT','DAY_DISCUSSION','DAY_VOTING');
create type public.player_role as enum ('WOLF','DOCTOR','DETECTIVE','CIVILIAN');
create type public.chat_channel as enum ('GLOBAL','WOLF_PRIVATE','DETECTIVE_PRIVATE');

create table public.profiles (
  id uuid primary key,
  username text not null unique,
  phone_number text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid not null,
  status public.room_status not null default 'LOBBY',
  current_phase public.game_phase,
  round_number integer not null default 0,
  phase_ends_at timestamptz,
  speaker_index integer not null default 0,
  winner text,
  created_at timestamptz not null default now()
);
grant select on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy rooms_select on public.rooms for select to authenticated using (true);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  role public.player_role,
  is_ready boolean not null default false,
  is_alive boolean not null default true,
  card_seen boolean not null default false,
  self_heal_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);
grant select on public.room_players to authenticated;
grant all on public.room_players to service_role;
alter table public.room_players enable row level security;

create table public.night_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  wolf_target_user_id uuid,
  detective_target_user_id uuid,
  doctor_target_user_id uuid,
  resolved boolean not null default false,
  unique (room_id, round_number)
);
grant select on public.night_actions to authenticated;
grant all on public.night_actions to service_role;
alter table public.night_actions enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid,
  channel public.chat_channel not null default 'GLOBAL',
  content text,
  audio_url text,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  voter_id uuid not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, voter_id)
);
grant select on public.votes to authenticated;
grant all on public.votes to service_role;
alter table public.votes enable row level security;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_players where room_id = p_room_id and user_id = auth.uid());
$$;

create or replace function public.my_role(p_room_id uuid)
returns public.player_role language sql stable security definer set search_path = public as $$
  select role from room_players where room_id = p_room_id and user_id = auth.uid();
$$;

create or replace function public.room_is_finished(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select status = 'FINISHED' from rooms where id = p_room_id;
$$;

create policy rp_select on public.room_players for select to authenticated
using (user_id = auth.uid() or is_alive = false or public.room_is_finished(room_id));

create policy votes_select on public.votes for select to authenticated
using (public.is_room_member(room_id));

create policy messages_select on public.messages for select to authenticated
using (
  public.is_room_member(room_id) and (
    channel = 'GLOBAL'
    or (channel = 'WOLF_PRIVATE' and public.my_role(room_id) = 'WOLF')
    or (channel = 'DETECTIVE_PRIVATE' and public.my_role(room_id) = 'DETECTIVE')
  )
);

create policy messages_insert on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (select 1 from room_players rp where rp.room_id = messages.room_id and rp.user_id = auth.uid() and rp.is_alive)
  and (
    channel = 'GLOBAL'
    or (channel = 'WOLF_PRIVATE' and public.my_role(room_id) = 'WOLF')
    or (channel = 'DETECTIVE_PRIVATE' and public.my_role(room_id) = 'DETECTIVE')
  )
);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.votes;

create policy "voice notes read" on storage.objects for select to authenticated using (bucket_id = 'voice-notes');
create policy "voice notes insert" on storage.objects for insert to authenticated with check (bucket_id = 'voice-notes');

-- ============ GAME ENGINE ============

create or replace function public.create_room()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from rooms where room_code = v_code);
  end loop;
  insert into rooms (room_code, host_id) values (v_code, auth.uid()) returning id into v_id;
  insert into room_players (room_id, user_id) values (v_id, auth.uid());
  return v_code;
end; $$;

create or replace function public.join_room(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_count int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_room from rooms where room_code = upper(p_code);
  if v_room.id is null then raise exception 'Room not found'; end if;
  if exists (select 1 from room_players where room_id = v_room.id and user_id = auth.uid()) then
    return v_room.id;
  end if;
  if v_room.status <> 'LOBBY' then raise exception 'Game already started'; end if;
  select count(*) into v_count from room_players where room_id = v_room.id;
  if v_count >= 15 then raise exception 'Room is full'; end if;
  insert into room_players (room_id, user_id) values (v_room.id, auth.uid());
  return v_room.id;
end; $$;

create or replace function public.set_ready(p_room_id uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update room_players set is_ready = p_ready where room_id = p_room_id and user_id = auth.uid();
end; $$;

create or replace function public.role_counts(p_total int)
returns table (wolves int, doctors int, detectives int) language sql immutable as $$
  select t.w, t.d, t.dt from (values
    (6,1,1,1),(7,1,1,1),(8,2,1,1),(9,2,1,1),(10,3,1,1),
    (11,3,2,1),(12,3,2,1),(13,4,2,1),(14,4,2,2),(15,5,2,2)
  ) as t(total, w, d, dt) where t.total = p_total;
$$;

create or replace function public.begin_night(p_room_id uuid, p_round int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into night_actions (room_id, round_number) values (p_room_id, p_round) on conflict do nothing;
  update rooms set current_phase = 'NIGHT_WOLVES', phase_ends_at = now() + interval '30 seconds',
    round_number = p_round where id = p_room_id;
  insert into messages (room_id, sender_id, channel, content)
    values (p_room_id, null, 'GLOBAL', 'Night ' || p_round || ' begins. Everyone goes to sleep.');
end; $$;

create or replace function public.start_game(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
  update room_players set role = 'CIVILIAN', is_alive = true, card_seen = false, self_heal_used = false
    where room_id = p_room_id;
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
end; $$;

create or replace function public.confirm_card(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_round int;
begin
  update room_players set card_seen = true where room_id = p_room_id and user_id = auth.uid();
  select round_number into v_round from rooms where id = p_room_id;
  if not exists (select 1 from room_players where room_id = p_room_id and not card_seen)
     and (select current_phase from rooms where id = p_room_id) = 'ROLE_DISTRIBUTION' then
    perform public.begin_night(p_room_id, v_round);
  end if;
end; $$;

create or replace function public.wolf_vote(p_room_id uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.current_phase <> 'NIGHT_WOLVES' then raise exception 'Not the wolves phase'; end if;
  if (select role from room_players where room_id = p_room_id and user_id = auth.uid() and is_alive) <> 'WOLF' then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = p_target and is_alive) then
    raise exception 'Invalid target';
  end if;
  update night_actions set wolf_target_user_id = p_target
    where room_id = p_room_id and round_number = v_room.round_number;
end; $$;

create or replace function public.detective_check(p_room_id uuid, p_target uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_is_wolf boolean; v_name text;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.current_phase <> 'NIGHT_DETECTIVE' then raise exception 'Not the detective phase'; end if;
  if (select role from room_players where room_id = p_room_id and user_id = auth.uid() and is_alive) <> 'DETECTIVE' then
    raise exception 'Not allowed';
  end if;
  if (select detective_target_user_id from night_actions where room_id = p_room_id and round_number = v_room.round_number) is not null then
    raise exception 'You already investigated this night';
  end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = p_target and is_alive) then
    raise exception 'Invalid target';
  end if;
  update night_actions set detective_target_user_id = p_target
    where room_id = p_room_id and round_number = v_room.round_number;
  select role = 'WOLF' into v_is_wolf from room_players where room_id = p_room_id and user_id = p_target;
  select username into v_name from profiles where id = p_target;
  insert into messages (room_id, sender_id, channel, content)
    values (p_room_id, auth.uid(), 'DETECTIVE_PRIVATE', 'Is ' || v_name || ' a wolf?');
  insert into messages (room_id, sender_id, channel, content)
    values (p_room_id, null, 'DETECTIVE_PRIVATE', case when v_is_wolf then 'Yes' else 'No' end);
  return v_is_wolf;
end; $$;

create or replace function public.doctor_heal(p_room_id uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_me room_players;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.current_phase <> 'NIGHT_DOCTOR' then raise exception 'Not the doctor phase'; end if;
  select * into v_me from room_players where room_id = p_room_id and user_id = auth.uid() and is_alive;
  if v_me.role <> 'DOCTOR' then raise exception 'Not allowed'; end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = p_target and is_alive) then
    raise exception 'Invalid target';
  end if;
  if p_target = auth.uid() then
    if v_me.self_heal_used then raise exception 'You can only heal yourself once per game'; end if;
    update room_players set self_heal_used = true where id = v_me.id;
  end if;
  update night_actions set doctor_target_user_id = p_target
    where room_id = p_room_id and round_number = v_room.round_number;
end; $$;

create or replace function public.check_win(p_room_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_wolves int; v_town int;
begin
  select count(*) filter (where role = 'WOLF'), count(*) filter (where role <> 'WOLF')
    into v_wolves, v_town from room_players where room_id = p_room_id and is_alive;
  if v_wolves = 0 then return 'TOWN'; end if;
  if v_wolves >= v_town then return 'WOLVES'; end if;
  return null;
end; $$;

create or replace function public.finish_or_next_night(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_winner text; v_round int;
begin
  v_winner := public.check_win(p_room_id);
  if v_winner is not null then
    update rooms set status = 'FINISHED', winner = v_winner, phase_ends_at = null where id = p_room_id;
    insert into messages (room_id, sender_id, channel, content)
      values (p_room_id, null, 'GLOBAL',
        case when v_winner = 'WOLVES' then 'GAME OVER - THE WOLVES WIN.' else 'GAME OVER - THE TOWN WINS.' end);
  else
    select round_number + 1 into v_round from rooms where id = p_room_id;
    perform public.begin_night(p_room_id, v_round);
  end if;
end; $$;

create or replace function public.resolve_night(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_na night_actions; v_name text; v_saved boolean;
begin
  select * into v_room from rooms where id = p_room_id;
  select * into v_na from night_actions where room_id = p_room_id and round_number = v_room.round_number;
  if v_na.id is null or v_na.resolved then return; end if;
  update night_actions set resolved = true where id = v_na.id;
  if v_na.wolf_target_user_id is null then
    insert into messages (room_id, sender_id, channel, content)
      values (p_room_id, null, 'GLOBAL', 'THE WOLFS CAME LAST NIGHT, BUT NOBODY WAS KILLED.');
  else
    select username into v_name from profiles where id = v_na.wolf_target_user_id;
    v_saved := v_na.doctor_target_user_id is not null and v_na.doctor_target_user_id = v_na.wolf_target_user_id;
    insert into messages (room_id, sender_id, channel, content)
      values (p_room_id, null, 'GLOBAL',
        'THE WOLFS CAME LAST NIGHT, AND THEY KILLED ' || upper(v_name) || '. ' ||
        case when v_saved then 'BUT THE DOCTOR SAVED HIM!' else 'SADLY THE DOCTOR DID NOT SAVE HIM.' end);
    if not v_saved then
      update room_players set is_alive = false
        where room_id = p_room_id and user_id = v_na.wolf_target_user_id;
    end if;
  end if;
  update rooms set current_phase = 'NIGHT_RESULT', phase_ends_at = now() + interval '10 seconds'
    where id = p_room_id;
end; $$;

create or replace function public.resolve_votes(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_target uuid; v_top int; v_ties int; v_name text;
begin
  select * into v_room from rooms where id = p_room_id;
  select target_id, count(*) into v_target, v_top from votes
    where room_id = p_room_id and round_number = v_room.round_number
    group by target_id order by count(*) desc limit 1;
  if v_target is null then
    insert into messages (room_id, sender_id, channel, content)
      values (p_room_id, null, 'GLOBAL', 'NO VOTES WERE CAST. NOBODY WAS ELIMINATED.');
  else
    select count(*) into v_ties from (
      select target_id, count(*) c from votes
        where room_id = p_room_id and round_number = v_room.round_number
        group by target_id having count(*) = v_top) t;
    if v_ties > 1 then
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, null, 'GLOBAL', 'THE VOTE WAS TIED. NOBODY WAS ELIMINATED.');
    else
      select username into v_name from profiles where id = v_target;
      update room_players set is_alive = false where room_id = p_room_id and user_id = v_target;
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, null, 'GLOBAL', 'THE TOWN HAS ELIMINATED ' || upper(v_name) || '. THEIR CARD IS REVEALED.');
    end if;
  end if;
  perform public.finish_or_next_night(p_room_id);
end; $$;

create or replace function public.tick_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
      update rooms set current_phase = 'DAY_VOTING', phase_ends_at = now() + interval '60 seconds' where id = p_room_id;
      insert into messages (room_id, sender_id, channel, content)
        values (p_room_id, null, 'GLOBAL', 'VOTING IS OPEN. YOU HAVE ONE MINUTE.');
    else
      update rooms set speaker_index = v_room.speaker_index + 1,
        phase_ends_at = now() + interval '60 seconds' where id = p_room_id;
    end if;
    return;
  end if;

  if v_room.current_phase = 'DAY_VOTING' then
    perform public.resolve_votes(p_room_id);
    return;
  end if;
end; $$;

create or replace function public.pass_turn(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update rooms set phase_ends_at = now() - interval '1 second'
    where id = p_room_id and current_phase = 'DAY_DISCUSSION';
  perform public.tick_room(p_room_id);
end; $$;

create or replace function public.cast_vote(p_room_id uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.current_phase <> 'DAY_VOTING' then raise exception 'Voting is not open'; end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = auth.uid() and is_alive) then
    raise exception 'Dead players cannot vote';
  end if;
  if not exists (select 1 from room_players where room_id = p_room_id and user_id = p_target and is_alive) then
    raise exception 'Invalid target';
  end if;
  insert into votes (room_id, round_number, voter_id, target_id)
    values (p_room_id, v_room.round_number, auth.uid(), p_target)
    on conflict (room_id, round_number, voter_id) do update set target_id = excluded.target_id;
end; $$;

create or replace function public.get_room_state(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
    'me', jsonb_build_object(
      'user_id', v_me.user_id, 'role', v_me.role, 'is_alive', v_me.is_alive,
      'is_ready', v_me.is_ready, 'card_seen', v_me.card_seen, 'self_heal_used', v_me.self_heal_used,
      'is_host', v_room.host_id = auth.uid()),
    'night', (select jsonb_build_object(
        'wolf_target', case when v_me.role = 'WOLF' then na.wolf_target_user_id end,
        'detective_target', case when v_me.role = 'DETECTIVE' then na.detective_target_user_id end,
        'doctor_target', case when v_me.role = 'DOCTOR' then na.doctor_target_user_id end)
      from night_actions na where na.room_id = p_room_id and na.round_number = v_room.round_number),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('voter_id', v.voter_id, 'target_id', v.target_id)), '[]'::jsonb)
      from votes v where v.room_id = p_room_id and v.round_number = v_room.round_number),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', rp.user_id, 'username', p.username, 'avatar_url', p.avatar_url,
        'is_ready', rp.is_ready, 'is_alive', rp.is_alive, 'card_seen', rp.card_seen,
        'is_host', rp.user_id = v_room.host_id,
        'role', case
          when rp.user_id = auth.uid() or not rp.is_alive or v_room.status = 'FINISHED'
            or (v_me.role = 'WOLF' and rp.role = 'WOLF') then rp.role::text
          else null end
      ) order by rp.created_at), '[]'::jsonb)
      from room_players rp join profiles p on p.id = rp.user_id where rp.room_id = p_room_id)
  ) into v_state;
  return v_state;
end; $$;

create or replace function public.room_id_by_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from rooms where room_code = upper(p_code);
$$;
