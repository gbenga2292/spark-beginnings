/**
 * Computes the number of working days in a given month for a given year,
 * mirroring =NETWORKDAYS.INTL(start, end, 11, holidays) from Excel.
 *
 * Weekend mode 11 = only Sundays are non-working days (Mon–Sat work).
 * Public holidays that fall on Mon–Sat are also excluded.
 *
 * @param year   Full year, e.g. 2026
 * @param month  1-indexed month (1 = January … 12 = December)
 * @param publicHolidayDates  Array of "YYYY-MM-DD" strings that are public holidays
 * @returns Number of working days
 */
/**
 * Computes the number of working days in a given date range.
 * Skips Sundays, and potentially Saturdays depending on workDaysPerWeek.
 * Also skips public holidays.
 */
export function computeWorkDaysInRange(
    startDate: Date,
    endDate: Date,
    publicHolidayDates: string[],
    workDaysPerWeek: number = 6
): number {
    const holidaySet = new Set(publicHolidayDates);
    let count = 0;
    
    // Create a copy to avoid mutating the original
    const d = new Date(startDate);
    // Normalize to start of day
    d.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    for (; d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
        if (dow === 0) continue; // Sunday — always off
        
        // Saturday logic
        if (workDaysPerWeek < 6 && dow === 6) continue;
        if (workDaysPerWeek < 7 && dow === 0) continue;
        if (dow > workDaysPerWeek) continue;

        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (holidaySet.has(iso)) continue;

        count++;
    }
    return count;
}

/**
 * Computes the number of working days in a given month for a given year.
 */
export function computeWorkDays(
    year: number,
    month: number,
    publicHolidayDates: string[],
    workDaysPerWeek: number = 6,
    startFromDate?: Date
): number {
    const monthStart = new Date(year, month - 1, 1);
    const lastDay   = new Date(year, month, 0);

    const firstDay = startFromDate && startFromDate > monthStart
        ? new Date(startFromDate)
        : monthStart;

    return computeWorkDaysInRange(firstDay, lastDay, publicHolidayDates, workDaysPerWeek);
}


export const MONTH_INDEX: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4,
    may: 5, jun: 6, jul: 7, aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Calculates the end date after adding a certain number of working days to a start date.
 * Skips Sundays, and potentially Saturdays depending on workDaysPerWeek.
 * Also skips public holidays.
 *
 * @param startDate "YYYY-MM-DD" or ISO string
 * @param duration Number of working days (leave days)
 * @param publicHolidayDates Array of "YYYY-MM-DD" strings that are public holidays
 * @param workDaysPerWeek Number of work days per week
 * @returns "YYYY-MM-DD" of the expected end date
 */
export function addWorkDays(
    startDate: string | Date,
    duration: number,
    publicHolidayDates: string[],
    workDaysPerWeek: number = 6
): string {
    if (!startDate || !duration || duration < 1) return '';

    const holidaySet = new Set(publicHolidayDates);
    const date = new Date(startDate);

    // The start date itself counts as Day 1.
    // So for duration=3 starting Apr 10 → end is Apr 12, not Apr 13.
    let daysAdded = 1;
    while (daysAdded < duration) {
        date.setDate(date.getDate() + 1);

        const dow = date.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
        if (dow === 0) continue; // Sunday
        if (workDaysPerWeek < 6 && dow === 6) continue; // Saturday off
        if (workDaysPerWeek < 7 && dow === 0) continue; // Sunday off (redundant)
        if (dow > workDaysPerWeek) continue; // safety fallback

        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (holidaySet.has(iso)) continue;

        daysAdded++;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

