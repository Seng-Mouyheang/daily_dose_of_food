/**
 * Deletes Cloudinary assets that were uploaded via the review wizard's Photos step — which
 * uploads straight to Cloudinary the moment a photo is added, well before the review is ever
 * published (see Step3Photos.svelte) — but never ended up referenced by a published review,
 * either because the photo was removed again before publish or the wizard was abandoned
 * entirely. Step3Photos.svelte registers each upload server-side as it happens (a `media_files`
 * row with `mediaStatus: 'pending'`, via /api/photos/register), so a draft that's realistically
 * still in progress is protected far longer than an asset with no row at all — see
 * GRACE_PERIOD_MS vs PENDING_UPLOAD_GRACE_PERIOD_MS in photoCleanupLogic.ts.
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
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { mediaFiles } from '../src/lib/server/db/schema/index.ts';
import {
	findOrphanedAssets,
	GRACE_PERIOD_MS,
	PENDING_UPLOAD_GRACE_PERIOD_MS,
	type UploadedAsset
} from '../src/lib/server/photoCleanupLogic.ts';

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

/** Extracts the uploader's userId from a publicId under UPLOAD_ROOT_PREFIX — the inverse of
 *  signUpload's folder scheme (see cloudinary.ts's publicIdBelongsToUser). */
function ownerUserIdFromPublicId(publicId: string): string | null {
	if (!publicId.startsWith(UPLOAD_ROOT_PREFIX)) return null;
	return publicId.slice(UPLOAD_ROOT_PREFIX.length).split('/')[0] || null;
}

/**
 * Atomically claims one orphan candidate for deletion immediately before destroying it — closes
 * the gap between the orphan-list query above and the eventual Cloudinary destroy call, during
 * which the asset could have been referenced by a publish. A plain re-read right before
 * deleting wouldn't close this on its own: the publish could still land in the moment between
 * that re-read and the destroy call. Safety instead comes from each branch below being a single
 * conditional SQL statement Postgres evaluates and commits atomically — either this call wins
 * the row (nothing has referenced the asset since the original read, so it's still safe to
 * destroy) or it doesn't (something did — skip it). publishReview's own matching check
 * (assertNoDeletedMedia, reviews.ts) closes the other direction: a publish that reads a row as
 * 'deleted' after this wins the claim is rejected outright.
 */
async function claimOrphanForDeletion(asset: UploadedAsset): Promise<boolean> {
	const [existing] = await db
		.select({ mediaStatus: mediaFiles.mediaStatus })
		.from(mediaFiles)
		.where(eq(mediaFiles.storageKey, asset.publicId))
		.limit(1);

	if (!existing) {
		const ownerUserId = ownerUserIdFromPublicId(asset.publicId);
		if (!ownerUserId) return false;
		const [claimed] = await db
			.insert(mediaFiles)
			.values({
				ownerUserId,
				storageKey: asset.publicId,
				url: '',
				bytes: asset.bytes,
				mediaStatus: 'deleted'
			})
			.onConflictDoNothing({ target: mediaFiles.storageKey })
			.returning({ id: mediaFiles.id });
		return !!claimed;
	}

	if (existing.mediaStatus !== 'pending') return false;
	const [claimed] = await db
		.update(mediaFiles)
		.set({ mediaStatus: 'deleted' })
		.where(and(eq(mediaFiles.storageKey, asset.publicId), eq(mediaFiles.mediaStatus, 'pending')))
		.returning({ id: mediaFiles.id });
	return !!claimed;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}

const [assets, rows] = await Promise.all([
	listUploadedAssets(),
	db
		.select({ storageKey: mediaFiles.storageKey, mediaStatus: mediaFiles.mediaStatus })
		.from(mediaFiles)
]);
// A 'pending' row (registered at upload time, never published — see /api/photos/register) only
// protects its asset for PENDING_UPLOAD_GRACE_PERIOD_MS, not indefinitely like any other status.
const referencedKeys = new Set(
	rows.filter((r) => r.mediaStatus !== 'pending').map((r) => r.storageKey)
);
const pendingKeys = new Set(
	rows.filter((r) => r.mediaStatus === 'pending').map((r) => r.storageKey)
);
const orphans = findOrphanedAssets(
	assets,
	referencedKeys,
	new Date(),
	GRACE_PERIOD_MS,
	pendingKeys,
	PENDING_UPLOAD_GRACE_PERIOD_MS
);

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
	// Claims each orphan before destroying it (see claimOrphanForDeletion) — one that got
	// referenced by a publish in the time since the query above is skipped instead of destroyed
	// out from under it.
	const won = await Promise.all(orphans.map((o) => claimOrphanForDeletion(o)));
	const claimed = orphans.filter((_, i) => won[i]);
	if (claimed.length) await destroyAssets(claimed.map((o) => o.publicId));
	const skipped = orphans.length - claimed.length;
	console.log(
		`\nDeleted ${claimed.length} orphaned photo(s).` +
			(skipped > 0 ? ` Skipped ${skipped} that got referenced in the meantime.` : '')
	);
}
