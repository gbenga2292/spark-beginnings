import { useEffect, useCallback, useRef } from 'react';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import { subDays, subMonths, isPast, format, addDays, startOfWeek, addWeeks, isAfter, isBefore } from 'date-fns';
import { supabase } from '@/src/integrations/supabase/client';

export function useVehicleDocumentSync() {
  const { mainTasks, subtasks, reminders, addReminder, createMainTask, addSubtask } = useAppData();
  const { vehicles, vehicleDocumentTypes } = useAppStore();
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
      // 1. Find or create "Vehicle Document" main task
      let mainTask = mainTasks.find(t => t.title === 'Vehicle Document' && !t.is_deleted);
      if (!mainTask) {
        mainTask = await createMainTask({
          title: 'Vehicle Document',
          description: 'Auto-generated task for tracking vehicle document renewals.',
          priority: 'high',
          skipAutoSubtask: true
        });
      }

      if (!mainTask) return;

      for (const vehicle of vehicles) {
        if (!vehicle.documents) continue;

        for (const [docTypeName, expiryDateStr] of Object.entries(vehicle.documents)) {
          if (!expiryDateStr) continue;
          
          const expiryDate = new Date(expiryDateStr as string);
          if (isNaN(expiryDate.getTime())) continue;

          const vehicleName = vehicle.name || vehicle.registration_number || 'Unknown Vehicle';
          const subtaskTitle = `Renewal of ${vehicleName}: ${docTypeName}`;
          const reminderTitle = `Reminder: ${subtaskTitle}`;
          
          // Dates for logic
          const now = new Date();
          const oneMonthBefore = subMonths(expiryDate, 1);
          const oneWeekBefore = subDays(expiryDate, 7);

          // 2. Handle Subtask (1 week before)
          const existingSub = subtasks.find(s => 
            s.mainTaskId === mainTask.id && 
            s.title === subtaskTitle &&
            s.status !== 'completed'
          );

          if (!existingSub && isAfter(now, oneWeekBefore) && !isPast(expiryDate)) {
            await addSubtask({
              mainTaskId: mainTask.id,
              title: subtaskTitle,
              deadline: expiryDate.toISOString(),
              priority: 'high',
              description: `Auto-generated renewal task for ${vehicleName} document: ${docTypeName}. Expiry: ${expiryDateStr}`
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
  }, [mainTasks, subtasks, reminders, vehicles, addReminder, createMainTask, addSubtask]);

  useEffect(() => {
    // Run sync when data is loaded or changes
    if (vehicles.length > 0 && mainTasks.length > 0) {
      sync();
    }
  }, [vehicles, mainTasks, sync]);
}
