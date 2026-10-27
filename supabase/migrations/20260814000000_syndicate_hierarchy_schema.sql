-- Syndicate Hierarchy Profile, Points, and Match History Migration

-- 1. Enhance profiles with Syndicate points and stats
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists rank_tier text not null default 'INFORMANT';
alter table public.profiles add column if not exists matches_played integer not null default 0;
alter table public.profiles add column if not exists matches_won integer not null default 0;
alter table public.profiles add column if not exists wolf_wins integer not null default 0;
alter table public.profiles add column if not exists town_wins integer not null default 0;
alter table public.profiles add column if not exists doctor_saves integer not null default 0;
alter table public.profiles add column if not exists detective_discoveries integer not null default 0;

-- 2. Create match_history table
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  role text,
  won boolean not null,
  survived boolean not null,
  points_earned integer not null default 0,
  rank_before text,
  rank_after text,
  details jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.match_history to authenticated;
grant all on public.match_history to service_role;
alter table public.match_history enable row level security;

create policy match_history_select on public.match_history
  for select to authenticated
  using (user_id = auth.uid());

create policy match_history_insert on public.match_history
  for insert to authenticated
  with check (user_id = auth.uid());

-- 3. Function to calculate rank tier from points
create or replace function public.calculate_rank_tier(p_points integer)
returns text language sql immutable as $$
  select case
    when p_points >= 2000 then 'GODFATHER'
    when p_points >= 1000 then 'UNDERBOSS'
    when p_points >= 500  then 'CAPOREGIME'
    when p_points >= 200  then 'ENFORCER'
    else 'INFORMANT'
  end;
$$;

-- 4. RPC function to record match outcome and award points
create or replace function public.award_match_points(
  p_user_id uuid,
  p_room_id uuid,
  p_won boolean,
  p_role text,
  p_survived boolean,
  p_doctor_saved boolean default false,
  p_detective_found boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pts integer := 0;
  v_cur_pts integer := 0;
  v_old_rank text;
  v_new_rank text;
  v_new_pts integer;
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_user_id <> auth.uid() then raise exception 'Can only award points to yourself'; end if;

  select points, rank_tier into v_cur_pts, v_old_rank from profiles where id = p_user_id;
  if v_cur_pts is null then
    v_cur_pts := 0;
    v_old_rank := 'INFORMANT';
  end if;

  -- Points logic:
  -- +50 for win
  -- +30 for wolf pack victory
  -- +20 for surviving until end
  -- +15 for doctor save
  -- +15 for detective discovery
  -- +10 baseline participation
  if p_won then
    v_pts := v_pts + 50;
    if p_role = 'WOLF' then
      v_pts := v_pts + 30;
    end if;
  end if;

  if p_survived then
    v_pts := v_pts + 20;
  end if;

  if p_doctor_saved then
    v_pts := v_pts + 15;
  end if;

  if p_detective_found then
    v_pts := v_pts + 15;
  end if;

  if v_pts = 0 then
    v_pts := 10;
  end if;

  v_new_pts := v_cur_pts + v_pts;
  v_new_rank := public.calculate_rank_tier(v_new_pts);

  update profiles set
    points = v_new_pts,
    rank_tier = v_new_rank,
    matches_played = matches_played + 1,
    matches_won = matches_won + case when p_won then 1 else 0 end,
    wolf_wins = wolf_wins + case when p_won and p_role = 'WOLF' then 1 else 0 end,
    town_wins = town_wins + case when p_won and p_role <> 'WOLF' then 1 else 0 end,
    doctor_saves = doctor_saves + case when p_doctor_saved then 1 else 0 end,
    detective_discoveries = detective_discoveries + case when p_detective_found then 1 else 0 end
  where id = p_user_id;

  insert into match_history (
    user_id, room_id, role, won, survived, points_earned, rank_before, rank_after, details
  ) values (
    p_user_id, p_room_id, p_role, p_won, p_survived, v_pts, v_old_rank, v_new_rank,
    jsonb_build_object('doctor_saved', p_doctor_saved, 'detective_found', p_detective_found)
  );

  select jsonb_build_object(
    'points_gained', v_pts,
    'total_points', v_new_pts,
    'rank_tier', v_new_rank,
    'rank_up', v_new_rank <> v_old_rank
  ) into v_res;

  return v_res;
end; $$;

grant execute on function public.award_match_points to authenticated, service_role;
