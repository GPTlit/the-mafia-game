
create policy night_actions_select on public.night_actions for select to authenticated
using (public.is_room_member(room_id));

alter function public.role_counts(int) set search_path = public;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from anon, public', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
