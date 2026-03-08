-- Fix search path on cleanup function
create or replace function public.cleanup_empty_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rooms
  where id in (
    select r.id
    from public.rooms r
    left join public.players p on p.room_id = r.id and p.connected = true
    where p.id is null
      and r.created_at < now() - interval '24 hours'
  );
end;
$$;