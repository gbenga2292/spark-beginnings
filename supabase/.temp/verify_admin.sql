BEGIN;
SELECT set_config('request.jwt.claims', '{"sub": "7bd0a3bc-25cc-4ac7-9602-ac0440f26bf1"}', true);
SELECT auth.uid();
SELECT public.is_admin();
COMMIT;
