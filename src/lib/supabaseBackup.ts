import { supabase } from '@/src/integrations/supabase/client';

export interface BackupResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  message?: string;
  method?: 'cli' | 'client';
}

/**
 * Triggers a full database backup.
 * If running in Electron, uses native save dialog and Supabase CLI dump.
 * If running in browser / Web, dumps tables via Supabase client and triggers file download.
 */
export async function performSupabaseDatabaseBackup(
  dbUrl?: string
): Promise<BackupResult> {
  const isElectron = !!(window as any).electronAPI?.isElectron;

  if (isElectron && (window as any).electronAPI?.backupSupabaseDatabase) {
    try {
      const result = await (window as any).electronAPI.backupSupabaseDatabase({ dbUrl });
      if (result.canceled) return { success: false, canceled: true };
      if (result.success) return result;

      // If CLI returned fallbackToClient, perform client-side table dump and save to the selected filePath
      if (result.fallbackToClient && result.filePath) {
        const sqlContent = await generateClientSqlDump();
        const writeOk = await (window as any).electronAPI.writeFile(result.filePath, sqlContent, 'utf8');
        if (writeOk) {
          return {
            success: true,
            filePath: result.filePath,
            method: 'client',
            message: 'Database tables exported to SQL file at selected location'
          };
        }
      }
    } catch (err: any) {
      console.error('Electron database backup failed:', err);
    }
  }

  // ── Web / Fallback Browser Download ──
  try {
    const sqlDump = await generateClientSqlDump();
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const defaultFileName = `Supabase_DB_Backup_${dateStr}.sql`;

    const blob = new Blob([sqlDump], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filePath: defaultFileName,
      method: 'client',
      message: 'Database tables exported to SQL file'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to generate database backup'
    };
  }
}

/**
 * Exact, authoritative list of public tables existing in the Supabase database schema.
 */
const SUPABASE_TABLES = [
  'profiles', 'app_settings', 'privilege_presets', 'clients', 'sites', 'positions',
  'departments', 'employees', 'attendance_records', 'invoices', 'pending_invoices',
  'salary_advances', 'loans', 'payments', 'vat_payments', 'public_holidays',
  'department_tasks', 'leaves', 'leave_types', 'disciplinary_records', 'evaluations',
  'ledger_categories', 'ledger_vendors', 'ledger_banks', 'ledger_entries',
  'ledger_beneficiary_banks', 'tasks', 'task_updates', 'reminders', 'main_tasks',
  'subtasks', 'audit_logs', 'comm_logs', 'company_expenses', 'pending_sites',
  'vehicles', 'assets', 'waybills', 'quick_checkouts', 'equipment_logs',
  'consumable_logs', 'return_bills', 'return_items', 'site_transactions',
  'activities', 'metrics_snapshots', 'maintenance_logs', 'op_company_settings',
  'permit_to_work', 'incident_log', 'vehicle_movement_log', 'staff_merit_record',
  'project_lifecycle_task', 'operations_assets', 'operations_waybills',
  'operations_checkouts', 'operations_maintenance', 'vehicle_document_types',
  'daily_journals', 'site_journal_entries', 'operations_daily_logs',
  'interview_candidates', 'operations_site_pump_dates', 'dewatering_layouts',
  'maintenance_certificates', 'vehicle_fuel_logs', 'diesel_refills',
  'client_contacts', 'budget_items', 'task_participant_status',
  'task_update_receipts', 'api_keys', 'workspace_settings', 'bank_audits'
];

/**
 * Fetches existing public data tables from Supabase client and formats as SQL INSERT statements.
 */
async function generateClientSqlDump(): Promise<string> {
  let sqlDump = `-- Supabase Logical Database Backup\n-- Exported: ${new Date().toLocaleString()}\n\n`;

  for (const table of SUPABASE_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (!error && data && data.length > 0) {
        sqlDump += `-- Table: ${table} (${data.length} records)\n`;
        data.forEach(row => {
          const keys = Object.keys(row).map(k => `"${k}"`).join(', ');
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          sqlDump += `INSERT INTO "${table}" (${keys}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        });
        sqlDump += `\n`;
      }
    } catch (e) {
      // Ignore if table query encounters error
    }
  }

  return sqlDump;
}
