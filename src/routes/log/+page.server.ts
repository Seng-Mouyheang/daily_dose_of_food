import { fail, redirect } from '@sveltejs/kit';
import { todayIn } from '#lib/dashboard/period.ts';
import { dailyBudget, parseLogQuery, streak } from '#lib/log/day.ts';
import { logVisitSchema } from '#lib/log/schema.ts';
import { getOrSyncUser, requireUser } from '#lib/server/auth.ts';
import { toNumber } from '#lib/server/feed.ts';
import { createLogs, getDayCounts, getLogMonth } from '#lib/server/logs.ts';
import { userTimeZone } from '#lib/server/timezone.ts';
import type { Actions, PageServerLoad } from './$types';

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

export const actions: Actions = {
	/** Saves one visit: a log per item. The form posts it as JSON, checked here again. */
	save: async ({ locals, request, cookies }) => {
		const user = await requireUser(locals);

		let json: unknown;
		try {
			json = JSON.parse(String((await request.formData()).get('payload') ?? 'null'));
		} catch {
			return fail(400, { message: 'Malformed submission.' });
		}
		const parsed = logVisitSchema(todayIn(userTimeZone(cookies))).safeParse(json);
		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Check the form and try again.'
			});
		}

		const v = parsed.data;
		const ids = await createLogs(user.id, v);
		return {
			saved: {
				ids,
				date: v.date,
				meal: v.meal,
				dining: v.dining,
				count: v.items.reduce((n, i) => n + i.qty, 0)
			}
		};
	}
};
