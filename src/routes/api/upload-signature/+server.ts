import { error, json } from '@sveltejs/kit';
import { signUpload } from '#lib/server/cloudinary.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.auth().userId) error(401, 'Sign in to upload images');
	return json(signUpload());
};
