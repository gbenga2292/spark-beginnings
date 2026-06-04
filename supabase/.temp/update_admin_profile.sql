-- Disable triggers by setting session_replication_role to replica
SET session_replication_role = 'replica';

UPDATE public.profiles
SET
  name = 'Tunde Alonge',
  privileges = '{"users":{"canView":true,"canManage":true,"canDelete":true},"employees":{"canView":true,"canManage":true,"canDelete":true},"clients":{"canView":true,"canManage":true,"canDelete":true},"projects":{"canView":true,"canManage":true,"canDelete":true},"finance":{"canView":true,"canManage":true,"canDelete":true},"invoices":{"canView":true,"canManage":true,"canDelete":true},"payroll":{"canView":true,"canManage":true,"canDelete":true},"operations":{"canView":true,"canManage":true,"canDelete":true},"reports":{"canView":true,"canManage":true,"canDelete":true},"settings":{"canView":true,"canManage":true,"canDelete":true},"admin":{"canView":true,"canManage":true,"canDelete":true}}'::jsonb,
  is_active = true
WHERE id = '7bd0a3bc-25cc-4ac7-9602-ac0440f26bf1';

-- Restore triggers
SET session_replication_role = 'origin';

SELECT id, name, email, privileges, is_active FROM public.profiles WHERE id = '7bd0a3bc-25cc-4ac7-9602-ac0440f26bf1';
