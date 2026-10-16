import type { Cookies } from '@sveltejs/kit';

/** Where the app's users are; used until the browser has set its `tz` cookie (root layout). */
export const DEFAULT_TIME_ZONE = 'Asia/Phnom_Penh';

/** The viewer's IANA time zone from the `tz` cookie, or the default if missing or not a real zone. */
export function userTimeZone(cookies: Cookies): string {
	const tz = cookies.get('tz');
	if (!tz) return DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat('en', { timeZone: tz });
		return tz;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}
