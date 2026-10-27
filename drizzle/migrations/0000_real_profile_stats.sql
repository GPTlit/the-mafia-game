alter table public.profiles
  add column if not exists points int not null default 0,
  add column if not exists rank_tier text not null default 'INFORMANT',
  add column if not exists matches_played int not null default 0,
  add column if not exists matches_won int not null default 0,
  add column if not exists wolf_wins int not null default 0,
  add column if not exists town_wins int not null default 0,
  add column if not exists doctor_saves int not null default 0,
  add column if not exists detective_discoveries int not null default 0;

create table public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null,
  role text,
  won boolean not null default false,
  survived boolean not null default false,
  points_earned int not null default 0,
  rank_before text,
  rank_after text,
  created_at timestamptz not null default now(),
  unique (user_id, room_id)
);
grant select on public.match_history to authenticated;
grant all on public.match_history to service_role;
alter table public.match_history enable row level security;
create policy mh_select on public.match_history for select to authenticated using (user_id = auth.uid());

create or replace function public.rank_for(p int) returns text language sql immutable set search_path = public as $$
  select case when p >= 2000 then 'GODFATHER' when p >= 1000 then 'UNDERBOSS'
    when p >= 500 then 'CAPOREGIME' when p >= 200 then 'ENFORCER' else 'INFORMANT' end $$;

create or replace function public.claim_match_reward(p_room_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_room rooms; v_me room_players; v_won boolean; v_pts int := 0; v_before int; v_rank_before text;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.status <> 'FINISHED' then raise exception 'Game not finished'; end if;
  select * into v_me from room_players where room_id = p_room_id and user_id = auth.uid();
  if v_me.id is null then raise exception 'Not a member'; end if;
  if exists (select 1 from match_history where user_id = auth.uid() and room_id = p_room_id) then return 0; end if;
  v_won := (v_room.winner = 'WOLVES') = (v_me.role = 'WOLF');
  if v_won then v_pts := v_pts + 50; if v_me.role = 'WOLF' then v_pts := v_pts + 30; end if; end if;
  if v_me.is_alive then v_pts := v_pts + 20; end if;
  if v_pts = 0 then v_pts := 10; end if;
  select points, rank_tier into v_before, v_rank_before from profiles where id = auth.uid();
  update profiles set points = points + v_pts, rank_tier = rank_for(points + v_pts),
    matches_played = matches_played + 1, matches_won = matches_won + (case when v_won then 1 else 0 end),
    wolf_wins = wolf_wins + (case when v_won and v_me.role = 'WOLF' then 1 else 0 end),
    town_wins = town_wins + (case when v_won and v_me.role <> 'WOLF' then 1 else 0 end)
  where id = auth.uid();
  insert into match_history (user_id, room_id, role, won, survived, points_earned, rank_before, rank_after)
  values (auth.uid(), p_room_id, v_me.role::text, v_won, v_me.is_alive, v_pts, v_rank_before, rank_for(coalesce(v_before,0) + v_pts));
  return v_pts;
end; $$;