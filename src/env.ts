import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	CLOUDINARY_CLOUD_NAME: { description: 'Cloudinary cloud name.' },
	CLOUDINARY_API_KEY: { description: 'Cloudinary API key.' },
	CLOUDINARY_API_SECRET: { description: 'Cloudinary API secret.' }
});
