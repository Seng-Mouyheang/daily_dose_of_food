import { json } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.ts';
import { signUpload } from '#lib/server/cloudinary.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals);
	return json(signUpload(user.id));
};
