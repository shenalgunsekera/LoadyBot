-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — Record an uploaded receipt (the file lives in Supabase Storage)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The receipts table already exists (0002). This adds the function the bots call
-- after uploading the screenshot: it files the row under the current club, links
-- it to the fill, and derives the player from the deposit. The file itself is in
-- the private `receipts` bucket; storage_path points at it (signed on view).
create or replace function receipt_add(p_fill uuid, p_storage_path text, p_content_type text)
returns receipts language plpgsql as $$
declare r receipts; v_ref text; v_player uuid;
begin
  select d.player_id into v_player
    from fills f left join deposit_requests d on d.id = f.deposit_id
   where f.id = p_fill;
  v_ref := 'RCP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into receipts (account_id, reference, player_id, ref_type, ref_id, url, storage_path, content_type)
  values (app.current_account(), v_ref, v_player, 'fill', p_fill, p_storage_path, p_storage_path, p_content_type)
  returning * into r;
  return r;
end $$;

grant execute on function receipt_add(uuid, text, text) to loady_app;
