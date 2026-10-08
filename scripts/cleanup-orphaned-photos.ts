/**
 * Deletes Cloudinary assets that were uploaded via the review wizard's Photos step — which
 * uploads straight to Cloudinary the moment a photo is added, well before the review is ever
 * published (see Step3Photos.svelte) — but never ended up referenced by a published review,
 * either because the photo was removed again before publish or the wizard was abandoned
 * entirely. Only touches assets older than the grace period (see photoCleanupLogic.ts), so an
 * in-progress draft's photos are never at risk.
 *
 * This is a standalone script (not an import of src/lib/server/photoCleanup.ts) because that
 * module and its db/cloudinary dependencies read secrets through SvelteKit's `$app/env/private`,
 * which only resolves inside the Vite/SvelteKit build — a plain `node` process can't load it.
 * Only photoCleanupLogic.ts (the pure diffing logic, no imports of its own) is safe to reuse
 * directly; everything else here re-implements the same thin Cloudinary/DB setup seed.ts already
 * uses for the same reason.
 *
 * Usage: pnpm cleanup:orphaned-photos [--dry-run]
 */
import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';
import { drizzle } from 'drizzle-orm/neon-http';
import { mediaFiles } from '../src/lib/server/db/schema/index.ts';
import { findOrphanedAssets, type UploadedAsset } from '../src/lib/server/photoCleanupLogic.ts';

const UPLOAD_ROOT_PREFIX = 'daily-dose-of-food/u/';
const dryRun = process.argv.includes('--dry-run');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const db = drizzle(neon(databaseUrl));

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true
});

async function listUploadedAssets(): Promise<UploadedAsset[]> {
	const assets: UploadedAsset[] = [];
	let nextCursor: string | undefined;
	do {
		const res = await cloudinary.api.resources({
			type: 'upload',
			prefix: UPLOAD_ROOT_PREFIX,
			max_results: 500,
			next_cursor: nextCursor
		});
		for (const r of res.resources) {
			assets.push({ publicId: r.public_id, createdAt: new Date(r.created_at), bytes: r.bytes });
		}
		nextCursor = res.next_cursor;
	} while (nextCursor);
	return assets;
}

async function destroyAssets(publicIds: string[]): Promise<void> {
	const batches: string[][] = [];
	for (let i = 0; i < publicIds.length; i += 100) batches.push(publicIds.slice(i, i + 100));
	await Promise.all(batches.map((batch) => cloudinary.api.delete_resources(batch)));
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}

const [assets, referenced] = await Promise.all([
	listUploadedAssets(),
	db.select({ storageKey: mediaFiles.storageKey }).from(mediaFiles)
]);
const referencedKeys = new Set(referenced.map((r) => r.storageKey));
const orphans = findOrphanedAssets(assets, referencedKeys, new Date());

if (orphans.length === 0) {
	console.log(`Checked ${assets.length} uploaded asset(s) — nothing orphaned.`);
	process.exit(0);
}

const totalBytes = orphans.reduce((sum, o) => sum + o.bytes, 0);
console.log(
	`Found ${orphans.length} orphaned photo(s) out of ${assets.length} total, ${formatBytes(totalBytes)}:`
);
for (const o of orphans) {
	console.log(
		`  - ${o.publicId}  (uploaded ${o.createdAt.toISOString()}, ${formatBytes(o.bytes)})`
	);
}

if (dryRun) {
	console.log('\n(dry run — nothing deleted; re-run without --dry-run to actually delete these)');
} else {
	await destroyAssets(orphans.map((o) => o.publicId));
	console.log(`\nDeleted ${orphans.length} orphaned photo(s).`);
}
