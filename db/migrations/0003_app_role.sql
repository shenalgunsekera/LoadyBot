-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — A dedicated app role so RLS is actually enforced
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Supabase's `postgres` role carries BYPASSRLS, which skips row-level security
-- entirely — even FORCE RLS. So all tenant work runs as `loady_app`, a plain
-- role with NO bypass: withAccount() does `SET LOCAL ROLE loady_app` before it
-- stamps app.current_account, and RLS is then enforced for real. Platform jobs
-- (asPlatform) stay as postgres and legitimately see across accounts.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'loady_app') then
    create role loady_app nologin;
  end if;
end $$;

-- postgres must be a member of loady_app to SET ROLE into it.
grant loady_app to postgres;

grant usage on schema public to loady_app;
grant usage on schema app to loady_app;
grant execute on function app.current_account() to loady_app;

grant select, insert, update, delete on all tables in schema public to loady_app;
grant usage, select on all sequences in schema public to loady_app;

-- Tables/sequences added by future migrations inherit the same grants.
alter default privileges in schema public grant select, insert, update, delete on tables to loady_app;
alter default privileges in schema public grant usage, select on sequences to loady_app;
