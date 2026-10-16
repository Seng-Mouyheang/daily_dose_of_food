import { fail, redirect } from '@sveltejs/kit';
import {
	addDays,
	canGoBack,
	parseDashboardQuery,
	periodFor,
	todayIn,
	zonedDayStart
} from '#lib/dashboard/period.ts';
import { summarize } from '#lib/dashboard/summary.ts';
import { getOrSyncUser } from '#lib/server/auth.ts';
import { getDashboardData, setMonthlyBudget } from '#lib/server/dashboard.ts';
import { toNumber } from '#lib/server/feed.ts';
import { userTimeZone } from '#lib/server/timezone.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const user = await getOrSyncUser(locals);
	if (!user) redirect(303, '/sign-in');

	const tz = userTimeZone(cookies);
	const today = todayIn(tz);
	const query = parseDashboardQuery(url.searchParams, today);
	const period = periodFor(
		query.per,
		query.off,
		today,
		query.from ? { from: query.from, to: query.to! } : undefined
	);

	// One fetch from the start of the comparison period to the end of this one.
	const { logs, firstVisitByPlace, firstLog } = await getDashboardData(
		user.id,
		zonedDayStart(period.prev.start, tz),
		zonedDayStart(addDays(period.end, 1), tz),
		tz
	);
	const inside = (from: string, to: string) => logs.filter((l) => l.date >= from && l.date <= to);

	const summary = summarize({
		logs: inside(period.start, period.live ? today : period.end),
		prevLogs: inside(period.prev.start, period.prev.end),
		period,
		today,
		monthlyBudget: toNumber(user.monthlyBudget),
		firstVisitByPlace
	});

	return {
		query,
		period,
		hasLogs: firstLog !== null,
		firstLog,
		today,
		canBack: canGoBack(period, firstLog),
		canForward: query.off < 0,
		monthlyBudget: toNumber(user.monthlyBudget),
		summary
	};
};

export const actions: Actions = {
	/** Empty clears the budget; otherwise a dollar amount between 0 and 100,000. */
	setBudget: async ({ locals, request }) => {
		const user = await getOrSyncUser(locals);
		if (!user) redirect(303, '/sign-in');

		const raw = String((await request.formData()).get('budget') ?? '')
			.trim()
			.replace(/[$,]/g, '');
		if (raw === '') {
			await setMonthlyBudget(user.id, null);
			return { ok: true };
		}
		const budget = Number(raw);
		if (!Number.isFinite(budget) || budget <= 0 || budget > 100_000)
			return fail(400, {
				budget: raw,
				error: 'Enter an amount between $1 and $100,000, or leave it empty to remove your budget.'
			});
		await setMonthlyBudget(user.id, Math.round(budget * 100) / 100);
		return { ok: true };
	}
};
