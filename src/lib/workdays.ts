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
export function computeWorkDays(
    year: number,
    month: number,
    publicHolidayDates: string[],
    workDaysPerWeek: number = 6
): number {
    // Build a Set of holiday date strings for O(1) lookup
    const holidaySet = new Set(publicHolidayDates);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // last day of month

    let count = 0;
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
        if (dow === 0) continue; // Sunday — always off
        // Saturday logic
        if (workDaysPerWeek < 6 && dow === 6) continue;
        if (workDaysPerWeek < 7 && dow === 0) continue;
        if (dow > workDaysPerWeek) continue; // fallback for lower bound e.g. 4 days

        // Use LOCAL year/month/day — NOT toISOString() which shifts to UTC
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (holidaySet.has(iso)) continue; // Public holiday — skip

        count++;
    }
    return count;
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
    
    let daysAdded = 0;
    while (daysAdded < duration) {
        // If duration is 1, it means 1 full day of leave.
        // We usually add the days one by one.
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

