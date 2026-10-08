import { getOrSyncUser } from '#lib/server/auth.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: await getOrSyncUser(locals) };
};
