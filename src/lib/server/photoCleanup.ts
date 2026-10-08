import { and, eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { mediaFiles } from './db/schema/index.ts';
import { destroyAssets, listUploadedAssets, UPLOAD_ROOT_PREFIX } from './cloudinary.ts';
import {
	findOrphanedAssets,
	GRACE_PERIOD_MS,
	PENDING_UPLOAD_GRACE_PERIOD_MS,
	type UploadedAsset
} from './photoCleanupLogic.ts';

export type { UploadedAsset };
export { findOrphanedAssets };

/** I/O: lists Cloudinary's current assets and the database's current media_files rows, then
 *  returns the orphans among them (see findOrphanedAssets). Read-only — nothing is deleted. A
 *  row with `mediaStatus: 'pending'` (registered at upload time, never published — see
 *  /api/photos/register) only protects its asset for PENDING_UPLOAD_GRACE_PERIOD_MS, not
 *  indefinitely like any other status. */
export async function findOrphanedPhotos(now = new Date()): Promise<UploadedAsset[]> {
	const [assets, rows] = await Promise.all([
		listUploadedAssets(),
		db
			.select({ storageKey: mediaFiles.storageKey, mediaStatus: mediaFiles.mediaStatus })
			.from(mediaFiles)
	]);
	const referencedKeys = new Set(
		rows.filter((r) => r.mediaStatus !== 'pending').map((r) => r.storageKey)
	);
	const pendingKeys = new Set(
		rows.filter((r) => r.mediaStatus === 'pending').map((r) => r.storageKey)
	);
	return findOrphanedAssets(
		assets,
		referencedKeys,
		now,
		GRACE_PERIOD_MS,
		pendingKeys,
		PENDING_UPLOAD_GRACE_PERIOD_MS
	);
}

/** Extracts the uploader's userId from a publicId under UPLOAD_ROOT_PREFIX — the inverse of
 *  signUpload's folder scheme (see cloudinary.ts's publicIdBelongsToUser) — needed to satisfy
 *  media_files' NOT NULL ownerUserId when claiming an orphan that was never registered at all
 *  (see claimOrphanForDeletion). */
function ownerUserIdFromPublicId(publicId: string): string | null {
	if (!publicId.startsWith(UPLOAD_ROOT_PREFIX)) return null;
	return publicId.slice(UPLOAD_ROOT_PREFIX.length).split('/')[0] || null;
}

/**
 * Atomically claims one orphan candidate for deletion immediately before destroying it —
 * closes the gap between the original orphan-list query (findOrphanedPhotos) and the eventual
 * Cloudinary destroy call, during which the asset could have been referenced by a publish. A
 * plain re-read right before deleting wouldn't close this on its own: the publish could still
 * land in the moment between that re-read and the destroy call. Safety instead comes from each
 * branch below being a single conditional SQL statement Postgres evaluates and commits
 * atomically — either this call wins the row (nothing has referenced the asset since the
 * original read, so it's still safe to destroy) or it doesn't (something did — skip it).
 * publishReview's own matching check (assertNoDeletedMedia) closes the other direction: a
 * publish that reads a row as 'deleted' after this wins the claim is rejected outright rather
 * than silently resurrecting a row whose Cloudinary asset is gone or about to be.
 */
export async function claimOrphanForDeletion(asset: UploadedAsset): Promise<boolean> {
	const [existing] = await db
		.select({ mediaStatus: mediaFiles.mediaStatus })
		.from(mediaFiles)
		.where(eq(mediaFiles.storageKey, asset.publicId))
		.limit(1);

	if (!existing) {
		// Nothing has ever registered this asset — claim it by inserting an already-'deleted'
		// placeholder row. If a publish's own insert for this same storageKey lands first,
		// onConflictDoNothing makes this a no-op and the claim correctly fails.
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
	// A row already exists and was still 'pending' as of the original read — flip it to
	// 'deleted', but only if it's *still* 'pending' right now: the WHERE clause re-checks the
	// current value in the same statement that writes it, so a publish that already flipped it
	// to 'active' in between makes this UPDATE match zero rows instead of racing past it.
	const [claimed] = await db
		.update(mediaFiles)
		.set({ mediaStatus: 'deleted' })
		.where(and(eq(mediaFiles.storageKey, asset.publicId), eq(mediaFiles.mediaStatus, 'pending')))
		.returning({ id: mediaFiles.id });
	return !!claimed;
}

/** I/O: claims then permanently deletes the given (already-identified) orphaned assets from
 *  Cloudinary — claiming first (see claimOrphanForDeletion) so one that got referenced by a
 *  publish since the original orphan-list query is skipped instead of destroyed out from under
 *  it. Returns only the assets actually claimed-and-deleted. */
export async function deleteOrphanedPhotos(orphans: UploadedAsset[]): Promise<UploadedAsset[]> {
	const won = await Promise.all(orphans.map((o) => claimOrphanForDeletion(o)));
	const claimed = orphans.filter((_, i) => won[i]);
	if (claimed.length) await destroyAssets(claimed.map((o) => o.publicId));
	return claimed;
}
