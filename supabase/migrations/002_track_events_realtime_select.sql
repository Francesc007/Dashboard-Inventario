-- Necesario para que el dashboard (cliente con anon key) reciba postgres_changes en track_events.
-- Solo lectura; los inserts siguen siendo vía API Next con service_role.
drop policy if exists "track_events_select_realtime" on public.track_events;

create policy "track_events_select_realtime"
  on public.track_events
  for select
  to anon, authenticated
  using (true);
