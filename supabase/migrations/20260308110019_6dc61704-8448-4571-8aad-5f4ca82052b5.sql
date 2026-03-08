
SELECT cron.schedule(
  'cleanup-inactive-rooms',
  '0 * * * *',
  $$SELECT public.cleanup_empty_rooms()$$
);
