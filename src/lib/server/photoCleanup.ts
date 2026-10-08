import { db } from './db/index.ts';
import { mediaFiles } from './db/schema/index.ts';
import { destroyAssets, listUploadedAssets } from './cloudinary.ts';
import { findOrphanedAssets, type UploadedAsset } from './photoCleanupLogic.ts';

export type { UploadedAsset };
export { findOrphanedAssets };

/** I/O: lists Cloudinary's current assets and the database's current referenced storage keys,
 *  then returns the orphans among them (see findOrphanedAssets). Read-only — nothing is deleted. */
export async function findOrphanedPhotos(now = new Date()): Promise<UploadedAsset[]> {
	const [assets, referenced] = await Promise.all([
		listUploadedAssets(),
		db.select({ storageKey: mediaFiles.storageKey }).from(mediaFiles)
	]);
	const referencedKeys = new Set(referenced.map((r) => r.storageKey));
	return findOrphanedAssets(assets, referencedKeys, now);
}

/** I/O: permanently deletes the given (already-identified) orphaned assets from Cloudinary. */
export function deleteOrphanedPhotos(orphans: UploadedAsset[]): Promise<void> {
	return destroyAssets(orphans.map((o) => o.publicId));
}
