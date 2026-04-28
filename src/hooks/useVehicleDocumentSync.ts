import { useEffect, useCallback, useRef } from 'react';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import { subDays, subMonths, isPast, format, addDays, startOfWeek, addWeeks, isAfter, isBefore, parse, parseISO } from 'date-fns';
import { supabase } from '@/src/integrations/supabase/client';
import { normalizeDate } from '@/src/lib/dateUtils';

export function useVehicleDocumentSync() {
  const { mainTasks, subtasks, reminders, users, addReminder, createMainTask, addSubtask } = useAppData();
  const { vehicles, vehicleDocumentTypes, employees } = useAppStore();
  const syncInProgress = useRef(false);

  const getNextMonday = (date: Date) => {
    // startOfWeek(date, { weekStartsOn: 1 }) gives the Monday of that week
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    // if the Monday of this week is in the past compared to our starting date, move to next week
    return isBefore(monday, date) ? addWeeks(monday, 1) : monday;
  };

  const sync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      // 1. Find or create "Renewal of Vehicle Documents" main task
      let mainTask = mainTasks.find(t => t.title === 'Renewal of Vehicle Documents' && !t.is_deleted);
      
      // Identify Operations users for assignment by checking employees table
      const opsEmployees = employees.filter(e => 
        (e.department || '').toLowerCase().includes('operations')
      );
      const opsEmails = new Set(opsEmployees.map(e => e.email?.toLowerCase()).filter(Boolean));
      const opsUsers = users.filter(u => opsEmails.has(u.email?.toLowerCase()));
      const firstOpsUserId = opsUsers.length > 0 ? opsUsers[0].id : null;

      if (!mainTask) {
        mainTask = await createMainTask({
          title: 'Renewal of Vehicle Documents',
          description: 'Consolidated task for all expired or expiring vehicle documents. Assigned to Operations.',
          priority: 'high',
          assignedTo: firstOpsUserId, // Assign to first ops user as primary contact
          skipAutoSubtask: true
        });
      }

      if (!mainTask) return;

      for (const vehicle of vehicles) {
        if (!vehicle.documents) continue;

        for (const [docTypeName, expiryDateStr] of Object.entries(vehicle.documents)) {
          if (!expiryDateStr) continue;
          
          // Parse date using application-standard normalization
          const normalizedExpiry = normalizeDate(expiryDateStr);
          if (!normalizedExpiry) {
            console.warn('Invalid vehicle document date format:', expiryDateStr, 'for', vehicle.registration_number);
            continue;
          }
          
          const expiryDate = parseISO(normalizedExpiry);
          if (isNaN(expiryDate.getTime())) continue;

          const vehicleName = vehicle.name || vehicle.registration_number || 'Unknown Vehicle';
          // Format: Document Name (Vehicle Name)
          const subtaskTitle = `${docTypeName} (${vehicleName})`;
          const reminderTitle = `Reminder: Renewal of ${subtaskTitle}`;
          
          // Dates for logic
          const now = new Date();
          const oneMonthBefore = subMonths(expiryDate, 1);
          const oneWeekBefore = subDays(expiryDate, 7);
          const isExpired = isPast(expiryDate);

          // 2. Handle Subtask (Expired or 1 week before)
          // Enhanced duplicate check: Look for existing subtask by metadata (preferred) or title
          const existingSub = subtasks.find(s => {
            const isRelated = (s.mainTaskId === mainTask.id || s.main_task_id === mainTask.id);
            if (!isRelated || s.is_deleted || s.status === 'completed') return false;

            // Try metadata match first (robust)
            try {
              if (s.description && s.description.trim().startsWith('{')) {
                const meta = JSON.parse(s.description);
                if (meta.refType === 'vehicle_doc_renewal' && 
                    meta.vehicleId === vehicle.id && 
                    meta.docTypeName === docTypeName) {
                    return true;
                }
              }
            } catch (e) {
              // Ignore parse errors for non-JSON descriptions
            }

            // Fallback: title match (check if existing title contains our base subtaskTitle)
            // This handles cases where the title might be "Insurance (Benz) [EXPIRED]" or just "Insurance (Benz)"
            return s.title.includes(subtaskTitle);
          });

          if (!existingSub && (isExpired || isAfter(now, oneWeekBefore))) {
            const statusLabel = isExpired ? 'EXPIRED' : 'EXPIRING SOON';
            const narration = `${docTypeName} for ${vehicleName} has ${isExpired ? 'expired' : 'is expiring'} on ${expiryDateStr}. Please initiate renewal immediately.`;
            
            // Description as JSON for automation (hidden in UI)
            const metadata = JSON.stringify({
              refType: 'vehicle_doc_renewal',
              vehicleId: vehicle.id,
              docTypeName: docTypeName,
              currentExpiry: expiryDateStr,
              narration: narration
            });

            await addSubtask({
              mainTaskId: mainTask.id,
              title: `${subtaskTitle} [${statusLabel}]`,
              deadline: normalizedExpiry, // Use YYYY-MM-DD for consistency
              priority: isExpired ? 'urgent' : 'high',
              assignedTo: firstOpsUserId,
              description: metadata
            });
          }

          // 3. Handle Reminder (1 month before, every Monday)
          // We look for an existing reminder for this specific vehicle/doc combination
          const existingRem = reminders.find(r => 
            r.mainTaskId === mainTask.id && 
            r.title === reminderTitle &&
            r.isActive
          );

          if (!existingRem && isAfter(now, oneMonthBefore) && !isPast(expiryDate)) {
            const firstMonday = getNextMonday(oneMonthBefore);
            
            await addReminder({
              title: reminderTitle,
              body: `${subtaskTitle} expires on ${format(expiryDate, 'PPP')}. Please initiate renewal.`,
              remindAt: firstMonday.toISOString(),
              endAt: expiryDate.toISOString(),
              frequency: 'weekly', // Every Monday (since we started on a Monday)
              mainTaskId: mainTask.id,
              isActive: true,
              recipientIds: [] // Global team reminder
            });
          }
        }
      }
    } catch (err) {
      console.error('useVehicleDocumentSync error:', err);
    } finally {
      syncInProgress.current = false;
    }
  }, [mainTasks, subtasks, reminders, vehicles, employees, addReminder, createMainTask, addSubtask, users]);

  useEffect(() => {
    // Run sync when data is loaded or changes
    if (vehicles.length > 0 && mainTasks.length > 0) {
      sync();
    }
  }, [vehicles, mainTasks, employees, sync]);
}
