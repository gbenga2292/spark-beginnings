import { AttendanceRecord, MonthValue } from '@/src/store/appStore';
import { format, addDays } from 'date-fns';
import { normalizeDate } from './dateUtils';

export interface AttendanceMetrics {
  ot: number;
  otSite: string;
  dayWk: number;
  nightWk: number;
  isPresent: 'Yes' | 'No';
  dow: number;
  mth: number;
  day2: number;
  ndw: 'Yes' | 'No';
}

/**
 * Calculates dynamic attendance metrics for a given record.
 * This ensures that if a date is later marked as a public holiday, 
 * the overtime and workdays are automatically updated without re-importing.
 */
export function calculateAttendanceMetrics(
  record: Partial<AttendanceRecord>,
  publicHolidays: string[], // "YYYY-MM-DD" array
  payrollVariables: any, // AppState['payrollVariables']
  monthValues: Record<string, MonthValue>,
  allRecords: AttendanceRecord[] = []
): AttendanceMetrics {
  const dateStr = record.date || '';
  if (!dateStr) {
    return { ot: 0, otSite: '', dayWk: 0, nightWk: 0, isPresent: 'No', dow: 0, mth: 0, day2: 0, ndw: 'No' };
  }

  // Ensure we parse the date string as local midnight to avoid timezone shift-back issues
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return { ot: 0, otSite: '', dayWk: 0, nightWk: 0, isPresent: 'No', dow: 0, mth: 0, day2: 0, ndw: 'No' };
  }

  const jsDay = d.getDay(); // 0=Sun
  const dow = jsDay === 0 ? 7 : jsDay;
  const mth = d.getMonth() + 1;
  const isHoliday = publicHolidays.includes(dateStr);
  const isSunday = dow === 7;

  const day = record.day === 'Yes';
  const night = record.night === 'Yes';
  const worked = day || night;

  // Determine NDW (Next Day Work) - used for night shift doubling logic
  let ndw: 'Yes' | 'No' = 'No';
  if (dow !== 7) {
    const nextDayStr = format(addDays(d, 1), 'yyyy-MM-dd');
    // Normalize dates for comparison to ensure robustness
    const staffWorksNextDay = allRecords.some(r => 
      r.staffId === record.staffId && 
      (normalizeDate(r.date) === nextDayStr) && 
      (r.day === 'Yes' || r.night === 'Yes')
    );
    
    if (staffWorksNextDay) {
      ndw = 'Yes';
    } else {
        const nextDayDow = (jsDay + 1) % 7 === 0 ? 7 : (jsDay + 1) % 7;
        const nextDayIsHolidayOrSun = publicHolidays.includes(nextDayStr) || nextDayDow === 7;
        if (nextDayIsHolidayOrSun) {
           const nextNextDayStr = format(addDays(d, 2), 'yyyy-MM-dd');
           const staffWorksNextNextDay = allRecords.some(r => 
             r.staffId === record.staffId && 
             (normalizeDate(r.date) === nextNextDayStr) && 
             (r.day === 'Yes' || r.night === 'Yes')
           );
           if (staffWorksNextNextDay) ndw = 'Yes';
        }
    }
  }

  // Overtime Calculation
  let ot = 0;
  if (
    (isSunday && worked) ||
    (isHoliday && worked) ||
    (day && night && ndw === 'Yes') ||
    !!record.overtimeDetails
  ) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    ot = monthValues[months[mth - 1]]?.overtimeRate ?? 0.5;
  }

  const nightWk = night ? 1 : 0;
  const otSite = ot > 0 ? (night ? record.nightSite || '' : record.daySite || '') : '';
  
  let dayWk = 0;
  if (ot > 0) {
    dayWk = 1;
  } else if (!day && !night) {
    dayWk = 0;
  } else if (!day) {
    dayWk = 1;
  } else if (night) {
    dayWk = 2;
  } else {
    dayWk = 1;
  }

  const isPresent = (worked || ndw === 'Yes') ? 'Yes' : 'No';
  const day2 = (day ? 1 : 0) + (night ? 1 : 0);

  return {
    ot,
    otSite,
    dayWk,
    nightWk,
    isPresent,
    dow,
    mth,
    day2,
    ndw
  };
}
