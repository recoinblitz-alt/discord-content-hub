COMMENT ON FUNCTION public.accept_org_invite(text) IS 'Atomically accepts a workspace invitation for the authenticated matching email.';
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;
NOTIFY pgrst, 'reload schema';