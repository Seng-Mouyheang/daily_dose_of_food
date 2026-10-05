import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	CLOUDINARY_CLOUD_NAME: { description: 'Cloudinary cloud name.' },
	CLOUDINARY_API_KEY: { description: 'Cloudinary API key.' },
	CLOUDINARY_API_SECRET: { description: 'Cloudinary API secret.' },
	PUBLIC_CLERK_PUBLISHABLE_KEY: { public: true, description: 'Clerk publishable key.' },
	CLERK_SECRET_KEY: { description: 'Clerk secret key.' },
	CLERK_WEBHOOK_SIGNING_SECRET: { description: 'Signing secret for the Clerk webhook endpoint.' }
});
