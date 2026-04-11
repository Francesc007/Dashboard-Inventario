-- Necesario para que el dashboard (cliente con anon key) reciba postgres_changes en landing_interactions.
-- Solo lectura; los inserts siguen siendo vía API Next con service_role.
drop policy if exists "landing_interactions_select_realtime" on public.landing_interactions;

create policy "landing_interactions_select_realtime"
  on public.landing_interactions
  for select
  to anon, authenticated
  using (true);
