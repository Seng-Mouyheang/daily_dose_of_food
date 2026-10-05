import { getOrSyncUser } from '#lib/server/auth.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { user: await getOrSyncUser(locals) };
};
