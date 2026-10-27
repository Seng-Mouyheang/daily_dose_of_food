import { redirect } from '@sveltejs/kit';
import { todayIn } from '#lib/dashboard/period.ts';
import { dailyBudget, parseLogQuery, streak } from '#lib/log/day.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { toNumber } from '#lib/server/feed.ts';
import { getDayCounts, getLogMonth } from '#lib/server/logs.ts';
import { userTimeZone } from '#lib/server/timezone.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const user = await getOrSyncUser(locals);
	if (!user) redirect(303, '/sign-in');

	const tz = userTimeZone(cookies);
	const today = todayIn(tz);
	const counts = await getDayCounts(user.id, tz);
	// Days before the first log can't be picked; with no logs yet only today can.
	const first = Object.keys(counts).sort()[0] ?? today;
	const { day, month } = parseLogQuery(url.searchParams, first < today ? first : today, today);

	// The day's list, and the calendar's month beside it when they differ.
	const months = [...new Set([day.slice(0, 7), month])];
	const entries = (await Promise.all(months.map((m) => getLogMonth(user.id, m, tz)))).flat();

	return {
		today,
		first: first < today ? first : today,
		day,
		month,
		counts,
		entries,
		streak: streak(counts, today),
		dailyBudget: dailyBudget(toNumber(user.monthlyBudget))
	};
};
