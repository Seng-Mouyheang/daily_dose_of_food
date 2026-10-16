import './scripts/network.ts';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	dialect: 'postgresql',
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL },
	// PostGIS owns spatial_ref_sys; without this, push sees it as unknown and tries to drop it.
	extensionsFilters: ['postgis'],
	verbose: true,
	strict: true
});
