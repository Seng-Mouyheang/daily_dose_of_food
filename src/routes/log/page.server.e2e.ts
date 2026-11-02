import { expect, test } from '@playwright/test';

/** Signed out only, like the rest of the app's e2e: there is no Clerk fixture, so the signed-in
 *  flows (saving, Undo, the visit sheet, writing a review from a visit) are covered by the unit
 *  specs for the logic behind them and checked by hand in the browser. What these pin down is
 *  that nothing of the Log is reachable without a session, whatever the id or the day asked for.
 *
 *  The same-origin header matters: without it SvelteKit's CSRF check answers 403 before the
 *  handler runs, which would make these pass or fail for a reason that has nothing to do with
 *  auth. */
const ID = 'c0ffee00-0000-4000-8000-000000000001';
const headers = { origin: 'http://localhost:4173' };

test('the log sends a signed-out visitor to sign in', async ({ request }) => {
	const res = await request.get('/log?day=2026-11-01', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/sign-in');
});

test('saving a log while signed out is a 401', async ({ request }) => {
	const res = await request.post('/log?/save', { form: { payload: '{}' }, headers });
	expect(res.status()).toBe(401);
});

test('log suggestions need a session', async ({ request }) => {
	expect((await request.get('/api/log/suggestions')).status()).toBe(401);
});

test('deleting logs while signed out is a 401', async ({ request }) => {
	const res = await request.delete('/api/log', { data: { ids: [ID] }, headers });
	expect(res.status()).toBe(401);
});

test('restoring logs while signed out is a 401', async ({ request }) => {
	const res = await request.put('/api/log', { data: { rows: [] }, headers });
	expect(res.status()).toBe(401);
});

test('writing a review from a log sends a signed-out visitor to sign in', async ({ request }) => {
	const res = await request.get(`/review/new?fromLog=${ID}`, { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/sign-in');
});
