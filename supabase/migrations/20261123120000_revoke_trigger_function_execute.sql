-- Trigger functions are never meant to be called through the API (/rest/v1/rpc/...).
-- Calling them fails anyway, but revoking EXECUTE keeps them out of the public API surface
-- and silences the Supabase security advisor. Triggers keep working: EXECUTE is only checked
-- when the trigger is created, not when it fires.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_correction_review() from public, anon, authenticated;
