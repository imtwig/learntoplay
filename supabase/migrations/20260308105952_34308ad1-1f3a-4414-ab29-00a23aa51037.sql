
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update cleanup function to remove ALL inactive rooms (with or without players) after 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_empty_rooms()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- First disconnect all players in old rooms
  UPDATE public.players
  SET connected = false
  WHERE room_id IN (
    SELECT r.id FROM public.rooms r
    WHERE r.created_at < now() - interval '24 hours'
  );

  -- Delete players from old rooms
  DELETE FROM public.players
  WHERE room_id IN (
    SELECT r.id FROM public.rooms r
    WHERE r.created_at < now() - interval '24 hours'
  );

  -- Remove host reference before deleting rooms
  UPDATE public.rooms
  SET host_player_id = NULL
  WHERE created_at < now() - interval '24 hours';

  -- Delete old rooms
  DELETE FROM public.rooms
  WHERE created_at < now() - interval '24 hours';

  -- Also close rooms where all players disconnected more than 1 hour ago
  UPDATE public.rooms
  SET status = 'closed'
  WHERE status != 'closed'
    AND id NOT IN (
      SELECT DISTINCT room_id FROM public.players WHERE connected = true
    )
    AND created_at < now() - interval '1 hour';
end;
$function$;
