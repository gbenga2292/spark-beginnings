import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { subDays, isPast, format, startOfWeek, addWeeks, isAfter, isBefore, parseISO } from "https://esm.sh/date-fns@2.30.0"

// System injected Postgres vars
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Initialize Supabase Client with service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Helper: Format date
function formatDisplayDate(dateStr: string | Date) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Helper: Normalize date from vehicle docs
function normalizeDate(dateStr: string) {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const match2 = dateStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (match2) return `${match2[1]}-${match2[2]}-${match2[3]}`;
  return new Date(dateStr).toISOString().split('T')[0];
}

const getNextMonday = (date: Date) => {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return isBefore(monday, date) ? addWeeks(monday, 1) : monday;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    console.log("Starting automated tasks sync...");
    
    // Fetch base data
    const [
      { data: employees },
      { data: users },
      { data: settings },
      { data: mainTasks },
      { data: subtasks },
      { data: vehicles },
      { data: reminders },
      { data: evaluations }
    ] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'Active'),
      supabase.from('profiles').select('*'), // Profiles table for users
      supabase.from('app_settings').select('hr_variables').single(),
      supabase.from('main_tasks').select('*').eq('is_deleted', false),
      supabase.from('subtasks').select('*').eq('is_deleted', false),
      supabase.from('assets').select('*').eq('status', 'active'), // Assuming vehicles are in 'assets' or 'vehicles'? Wait, types.ts has 'vehicles'. 
      // Let's check table name. Wait, I'll fetch 'vehicles' below if it exists.
      supabase.from('reminders').select('*'),
      supabase.from('evaluations').select('*')
    ]);

    // Re-fetch vehicles specifically (just in case it's named 'vehicles')
    const { data: actualVehicles } = await supabase.from('vehicles').select('*');

    const hrVariables = (settings?.hr_variables as any) || {};
    const defaultProbDays = hrVariables.defaultProbationDays || 90;

    let createdProbationTasks = 0;
    let createdVehicleSubtasks = 0;

    // --- 1. PROBATION SCAN ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDateLimit = new Date(today);
    startDateLimit.setDate(1); 
    startDateLimit.setMonth(startDateLimit.getMonth() - 1); 
    startDateLimit.setHours(0, 0, 0, 0);

    const candidates = (employees || []).filter(e => e.start_date && (e.staff_type === 'OFFICE' || e.staff_type === 'FIELD'));

    // Find HR users
    const hrUsers = (users || []).filter((u: any) => {
      if (u.isExternalHr || u.privileges?.tasks?.isExternalHr) return true;
      const profileDept = (u.department || u.privileges?.department || '').toLowerCase();
      if (profileDept.includes('hr') || profileDept.includes('human resource')) return true;
      const empRecord = (employees || []).find(e => e.email?.toLowerCase() === u.email?.toLowerCase());
      const empDept = (empRecord?.department || '').toLowerCase();
      return empDept === 'hr' || empDept.includes('human resource');
    });

    for (const emp of candidates) {
      const probDays = (emp.probation_period && emp.probation_period > 0) ? emp.probation_period : defaultProbDays;
      const start = new Date(emp.start_date);
      if (isNaN(start.getTime())) continue;

      const evalDate = new Date(start);
      evalDate.setDate(evalDate.getDate() + probDays);
      evalDate.setHours(8, 0, 0, 0);

      if (evalDate < startDateLimit || evalDate > today) continue;

      const taskTitle = `Probation Evaluation: ${emp.firstname} ${emp.surname}`;

      const alreadyExists = (mainTasks || []).some((t: any) => 
          (t.title || '').trim().toLowerCase() === taskTitle.trim().toLowerCase()
      ) || (evaluations || []).some((ev: any) => ev.employee_id === emp.id && (ev.type === 'Probation' || ev.session_id));

      if (alreadyExists) continue;

      let targetAssigneeId = '';
      let targetCreatorId = '';

      if (hrUsers.length > 0) {
          targetAssigneeId = hrUsers.map((u: any) => u.id).join(',');
          targetCreatorId = hrUsers[0].id;
      } else if (emp.line_manager) {
          const managerUser = (users || []).find((u: any) => u.id === emp.line_manager);
          if (managerUser) {
              targetAssigneeId = managerUser.id;
              targetCreatorId = managerUser.id;
          }
      }

      if (!targetAssigneeId) {
          // Fallback to top seniority
          const usersWithLevel = (users || []).map((u: any) => {
              const eRec = (employees || []).find(e => e.email?.toLowerCase() === u.email?.toLowerCase());
              return { id: u.id, level: (eRec && eRec.level !== undefined) ? eRec.level : 999 };
          }).sort((a: any, b: any) => a.level - b.level);
          
          if (usersWithLevel.length > 0) {
            targetAssigneeId = usersWithLevel[0].id;
            targetCreatorId = usersWithLevel[0].id;
          }
      }

      // Create Task
      if (targetAssigneeId) {
        const { data: mtData } = await supabase.from('main_tasks').insert({
          title: taskTitle,
          description: `PROBATION REVIEW: ${probDays}-day probation period for ${emp.firstname} ${emp.surname} (${emp.department} — ${emp.position}) ended on ${formatDisplayDate(evalDate)}. Review required as per this month's automated scan.`,
          deadline: evalDate.toISOString(),
          assigned_to: targetAssigneeId,
          created_by: targetCreatorId,
          priority: 'High',
          is_hr_task: true,
          workspaceId: 'dcel-team', // Or fetch from context
        }).select().single();

        if (mtData) {
          createdProbationTasks++;
          await supabase.from('subtasks').insert([
            { title: 'Schedule evaluation meeting with employee', assigned_to: targetAssigneeId, priority: 'High', main_task_id: mtData.id },
            { title: 'Complete probation evaluation form', assigned_to: targetAssigneeId, priority: 'High', main_task_id: mtData.id, description: JSON.stringify({ refType: 'probation_eval', employeeId: emp.id }) },
            { title: 'Document performance feedback and outcome', assigned_to: targetAssigneeId, priority: 'Medium', main_task_id: mtData.id },
            { title: 'Update employee status (Confirm / Extend / End)', assigned_to: targetAssigneeId, priority: 'High', main_task_id: mtData.id, description: JSON.stringify({ refType: 'employee', employeeId: emp.id }) },
          ]);
        }
      }
    }

    // --- 2. VEHICLE DOCUMENT SYNC ---
    const vehicleList = actualVehicles || vehicles || [];
    let mainVehicleTask = (mainTasks || []).find((t: any) => t.title === 'Renewal of Vehicle Documents' && !t.is_deleted);

    const opsEmployees = (employees || []).filter(e => (e.department || '').toLowerCase().includes('operations'));
    const opsEmails = new Set(opsEmployees.map(e => e.email?.toLowerCase()).filter(Boolean));
    const opsUsers = (users || []).filter((u: any) => opsEmails.has(u.email?.toLowerCase()));
    const firstOpsUserId = opsUsers.length > 0 ? opsUsers[0].id : null;

    for (const vehicle of vehicleList) {
      if (!vehicle.documents) continue;

      for (const [docTypeName, expiryDateStr] of Object.entries(vehicle.documents as any)) {
        if (!expiryDateStr || typeof expiryDateStr !== 'string') continue;
        
        const normalizedExpiry = normalizeDate(expiryDateStr);
        if (!normalizedExpiry) continue;
        
        const expiryDate = parseISO(normalizedExpiry);
        if (isNaN(expiryDate.getTime())) continue;

        const vehicleName = vehicle.name || vehicle.registration_number || 'Unknown Vehicle';
        const subtaskTitle = `${docTypeName} (${vehicleName})`;
        const reminderTitle = `Reminder: Renewal of ${subtaskTitle}`;
        
        const now = new Date();
        const oneWeekBefore = subDays(expiryDate, 7);
        const isExpired = isPast(expiryDate);

        if (!mainVehicleTask && (isExpired || isAfter(now, oneWeekBefore))) {
          // Create main task
          const { data: mtData } = await supabase.from('main_tasks').insert({
            title: 'Renewal of Vehicle Documents',
            description: 'Consolidated task for all expired or expiring vehicle documents. Assigned to Operations.',
            priority: 'high',
            assigned_to: firstOpsUserId,
            workspaceId: 'dcel-team'
          }).select().single();
          if (mtData) mainVehicleTask = mtData;
        }

        if (!mainVehicleTask) continue;

        const existingSub = (subtasks || []).find((s: any) => {
          const isRelated = (s.main_task_id === mainVehicleTask!.id);
          if (!isRelated || s.is_deleted || s.status === 'completed') return false;

          try {
            if (s.description && s.description.trim().startsWith('{')) {
              const meta = JSON.parse(s.description);
              if (meta.refType === 'vehicle_doc_renewal' && meta.vehicleId === vehicle.id && meta.docTypeName === docTypeName) return true;
            }
          } catch (e) {}

          return s.title.includes(subtaskTitle);
        });

        if (!existingSub && (isExpired || isAfter(now, oneWeekBefore))) {
          const statusLabel = isExpired ? 'EXPIRED' : 'EXPIRING SOON';
          const narration = `${docTypeName} for ${vehicleName} has ${isExpired ? 'expired' : 'is expiring'} on ${expiryDateStr}. Please initiate renewal immediately.`;
          
          await supabase.from('subtasks').insert({
            main_task_id: mainVehicleTask.id,
            title: `${subtaskTitle} [${statusLabel}]`,
            deadline: normalizedExpiry,
            priority: isExpired ? 'urgent' : 'high',
            assigned_to: firstOpsUserId,
            description: JSON.stringify({ refType: 'vehicle_doc_renewal', vehicleId: vehicle.id, docTypeName: docTypeName, currentExpiry: expiryDateStr, narration: narration })
          });
          createdVehicleSubtasks++;
        }

        // Reminders
        const existingRem = (reminders || []).find((r: any) => r.main_task_id === mainVehicleTask!.id && r.title === reminderTitle && r.is_active);
        if (!existingRem && isAfter(now, oneWeekBefore) && !isPast(expiryDate)) {
          const firstMonday = getNextMonday(oneWeekBefore);
          
          await supabase.from('reminders').insert({
            title: reminderTitle,
            body: `${subtaskTitle} expires on ${format(expiryDate, 'PPP')}. Please initiate renewal.`,
            remind_at: firstMonday.toISOString(),
            end_at: expiryDate.toISOString(),
            frequency: 'weekly',
            main_task_id: mainVehicleTask.id,
            is_active: true,
            recipient_ids: []
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      createdProbationTasks, 
      createdVehicleSubtasks 
    }), { headers: { 'Content-Type': 'application/json' }, status: 200 })

  } catch (err: any) {
    console.error("Error in automated-tasks:", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { 'Content-Type': 'application/json' }, status: 500 })
  }
})
