-- ledger_entries
CREATE POLICY "ledger_entries view access" ON public.ledger_entries FOR SELECT USING (((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "ledger_entries manage access" ON public.ledger_entries FOR ALL USING (((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- ledger_banks
CREATE POLICY "ledger_banks view access" ON public.ledger_banks FOR SELECT USING (((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "ledger_banks manage access" ON public.ledger_banks FOR ALL USING (((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- ledger_vendors
CREATE POLICY "ledger_vendors view access" ON public.ledger_vendors FOR SELECT USING (((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "ledger_vendors manage access" ON public.ledger_vendors FOR ALL USING (((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- ledger_categories
CREATE POLICY "ledger_categories view access" ON public.ledger_categories FOR SELECT USING (((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "ledger_categories manage access" ON public.ledger_categories FOR ALL USING (((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- ledger_beneficiary_banks
CREATE POLICY "ledger_beneficiary_banks view access" ON public.ledger_beneficiary_banks FOR SELECT USING (((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "ledger_beneficiary_banks manage access" ON public.ledger_beneficiary_banks FOR ALL USING (((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- tasks
CREATE POLICY "tasks view access" ON public.tasks FOR SELECT USING (((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "tasks manage access" ON public.tasks FOR ALL USING (((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- main_tasks
CREATE POLICY "main_tasks view access" ON public.main_tasks FOR SELECT USING (((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "main_tasks manage access" ON public.main_tasks FOR ALL USING (((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- subtasks
CREATE POLICY "subtasks view access" ON public.subtasks FOR SELECT USING (((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "subtasks manage access" ON public.subtasks FOR ALL USING (((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- task_updates
CREATE POLICY "task_updates view access" ON public.task_updates FOR SELECT USING (((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "task_updates manage access" ON public.task_updates FOR ALL USING (((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- project_lifecycle_task
CREATE POLICY "project_lifecycle_task view access" ON public.project_lifecycle_task FOR SELECT USING (((SELECT (privileges->'tasks'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "project_lifecycle_task manage access" ON public.project_lifecycle_task FOR ALL USING (((SELECT (privileges->'tasks'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- assets
CREATE POLICY "assets view access" ON public.assets FOR SELECT USING (((SELECT (privileges->'opsInventory'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "assets manage access" ON public.assets FOR ALL USING (((SELECT (privileges->'opsInventory'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- operations_assets
CREATE POLICY "operations_assets view access" ON public.operations_assets FOR SELECT USING (((SELECT (privileges->'opsInventory'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "operations_assets manage access" ON public.operations_assets FOR ALL USING (((SELECT (privileges->'opsInventory'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- consumable_logs
CREATE POLICY "consumable_logs view access" ON public.consumable_logs FOR SELECT USING (((SELECT (privileges->'opsInventory'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "consumable_logs manage access" ON public.consumable_logs FOR ALL USING (((SELECT (privileges->'opsInventory'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- site_transactions
CREATE POLICY "site_transactions view access" ON public.site_transactions FOR SELECT USING (((SELECT (privileges->'opsInventory'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "site_transactions manage access" ON public.site_transactions FOR ALL USING (((SELECT (privileges->'opsInventory'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- waybills
CREATE POLICY "waybills view access" ON public.waybills FOR SELECT USING (((SELECT (privileges->'opsWaybills'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "waybills manage access" ON public.waybills FOR ALL USING (((SELECT (privileges->'opsWaybills'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- operations_waybills
CREATE POLICY "operations_waybills view access" ON public.operations_waybills FOR SELECT USING (((SELECT (privileges->'opsWaybills'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "operations_waybills manage access" ON public.operations_waybills FOR ALL USING (((SELECT (privileges->'opsWaybills'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- return_bills
CREATE POLICY "return_bills view access" ON public.return_bills FOR SELECT USING (((SELECT (privileges->'opsWaybills'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "return_bills manage access" ON public.return_bills FOR ALL USING (((SELECT (privileges->'opsWaybills'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- return_items
CREATE POLICY "return_items view access" ON public.return_items FOR SELECT USING (((SELECT (privileges->'opsWaybills'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "return_items manage access" ON public.return_items FOR ALL USING (((SELECT (privileges->'opsWaybills'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- quick_checkouts
CREATE POLICY "quick_checkouts view access" ON public.quick_checkouts FOR SELECT USING (((SELECT (privileges->'opsCheckout'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "quick_checkouts manage access" ON public.quick_checkouts FOR ALL USING (((SELECT (privileges->'opsCheckout'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- operations_checkouts
CREATE POLICY "operations_checkouts view access" ON public.operations_checkouts FOR SELECT USING (((SELECT (privileges->'opsCheckout'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "operations_checkouts manage access" ON public.operations_checkouts FOR ALL USING (((SELECT (privileges->'opsCheckout'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- maintenance_logs
CREATE POLICY "maintenance_logs view access" ON public.maintenance_logs FOR SELECT USING (((SELECT (privileges->'opsMaintenance'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "maintenance_logs manage access" ON public.maintenance_logs FOR ALL USING (((SELECT (privileges->'opsMaintenance'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- operations_maintenance
CREATE POLICY "operations_maintenance view access" ON public.operations_maintenance FOR SELECT USING (((SELECT (privileges->'opsMaintenance'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "operations_maintenance manage access" ON public.operations_maintenance FOR ALL USING (((SELECT (privileges->'opsMaintenance'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- equipment_logs
CREATE POLICY "equipment_logs view access" ON public.equipment_logs FOR SELECT USING (((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "equipment_logs manage access" ON public.equipment_logs FOR ALL USING (((SELECT (privileges->'operations'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- operations_daily_logs
CREATE POLICY "operations_daily_logs view access" ON public.operations_daily_logs FOR SELECT USING (((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "operations_daily_logs manage access" ON public.operations_daily_logs FOR ALL USING (((SELECT (privileges->'operations'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- incident_log
CREATE POLICY "incident_log view access" ON public.incident_log FOR SELECT USING (((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "incident_log manage access" ON public.incident_log FOR ALL USING (((SELECT (privileges->'operations'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- permit_to_work
CREATE POLICY "permit_to_work view access" ON public.permit_to_work FOR SELECT USING (((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "permit_to_work manage access" ON public.permit_to_work FOR ALL USING (((SELECT (privileges->'operations'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- activities
CREATE POLICY "activities view access" ON public.activities FOR SELECT USING (((SELECT (privileges->'activityLog'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "activities manage access" ON public.activities FOR ALL USING (((SELECT (privileges->'activityLog'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- op_company_settings
CREATE POLICY "op_company_settings view access" ON public.op_company_settings FOR SELECT USING (((SELECT (privileges->'variables'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "op_company_settings manage access" ON public.op_company_settings FOR ALL USING (((SELECT (privileges->'variables'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- metrics_snapshots
CREATE POLICY "metrics_snapshots view access" ON public.metrics_snapshots FOR SELECT USING (((SELECT (privileges->'dashboard'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "metrics_snapshots manage access" ON public.metrics_snapshots FOR ALL USING (((SELECT (privileges->'dashboard'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- pending_sites
CREATE POLICY "pending_sites view access" ON public.pending_sites FOR SELECT USING (((SELECT (privileges->'sites'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());
CREATE POLICY "pending_sites manage access" ON public.pending_sites FOR ALL USING (((SELECT (privileges->'sites'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true) OR public.is_admin());

-- reminders
CREATE POLICY "reminders view access" ON public.reminders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reminders manage access" ON public.reminders FOR ALL USING (auth.role() = 'authenticated');

