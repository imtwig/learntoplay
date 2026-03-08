-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Function to clean up empty rooms older than 24 hours
create or replace function public.cleanup_empty_rooms()
returns void
language plpgsql
security definer
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