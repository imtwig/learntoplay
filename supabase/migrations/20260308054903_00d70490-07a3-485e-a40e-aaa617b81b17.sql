-- Schedule hourly cleanup of empty rooms older than 24 hours
select cron.schedule(
  'cleanup-empty-rooms',
  '0 * * * *',
  $$select public.cleanup_empty_rooms()$$
);