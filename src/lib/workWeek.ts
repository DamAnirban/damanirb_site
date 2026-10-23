// Work weeks run Sunday..Saturday, and ww1 is the week containing Jan 1 - so
// the last days of December can belong to ww1 of the next year (e.g. Mon
// Dec 28, 2026 is ww1.1 of 2027, and Fri Jan 1, 2027 is ww1.5). Monday is .1
// through Friday .5; weekends get no workday label.
//
// All dates are handled in UTC so the build machine's timezone can't shift a day.

const DAY_MS = 86_400_000;

export interface CalendarDay {
	/** Day of month, or null for padding cells outside the month. */
	day: number | null;
	/** YYYY-MM-DD, set only for days inside the month. */
	iso?: string;
	isWeekend: boolean;
	/** e.g. "ww23.2"; only for weekdays inside the month. */
	label?: string;
}

export interface CalendarWeek {
	ww: number;
	days: CalendarDay[]; // Sunday..Saturday
}

export interface CalendarMonth {
	name: string;
	weeks: CalendarWeek[];
}

/** Work-week number for the Sunday-to-Saturday week starting on `sunday`. */
export function workWeek(sunday: Date): number {
	// The week containing Jan 1 always ends (Saturday) in the new year, so the
	// Saturday decides which year this week is numbered in.
	const saturday = new Date(sunday.getTime() + 6 * DAY_MS);
	const jan1 = Date.UTC(saturday.getUTCFullYear(), 0, 1);
	const firstSunday = jan1 - new Date(jan1).getUTCDay() * DAY_MS;
	return Math.round((sunday.getTime() - firstSunday) / (7 * DAY_MS)) + 1;
}

export function buildYear(year: number): CalendarMonth[] {
	return Array.from({ length: 12 }, (_, month) => {
		const first = new Date(Date.UTC(year, month, 1));
		const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
		const name = first.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

		// Start from the Sunday on or before the 1st.
		const offset = first.getUTCDay();
		const cursor = new Date(Date.UTC(year, month, 1 - offset));
		const rowCount = Math.ceil((offset + daysInMonth) / 7);

		const weeks: CalendarWeek[] = [];
		for (let row = 0; row < rowCount; row++) {
			const ww = workWeek(cursor);
			const days: CalendarDay[] = [];
			for (let i = 0; i < 7; i++) {
				const isWeekend = i === 0 || i === 6;
				days.push(
					cursor.getUTCMonth() === month
						? {
								day: cursor.getUTCDate(),
								iso: cursor.toISOString().slice(0, 10),
								isWeekend,
								label: isWeekend ? undefined : `ww${ww}.${i}`,
							}
						: { day: null, isWeekend },
				);
				cursor.setUTCDate(cursor.getUTCDate() + 1);
			}
			weeks.push({ ww, days });
		}
		return { name, weeks };
	});
}
