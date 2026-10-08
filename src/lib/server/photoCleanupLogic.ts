/**
 * The pure half of the orphaned-photo cleanup (see photoCleanup.ts for the I/O side). Kept
 * import-free — no `$app/env/private`, no `db/index.ts`, no `cloudinary.ts` — so the standalone
 * `scripts/cleanup-orphaned-photos.ts` script can import it directly via plain `node`, the same
 * way seed.ts reuses schema/seed-data without importing anything SvelteKit-coupled.
 */

export interface UploadedAsset {
	publicId: string;
	createdAt: Date;
	bytes: number;
}

/**
 * How long to leave a freshly-uploaded photo alone before it's eligible for cleanup. Step 3 of
 * the review wizard (Step3Photos.svelte) uploads straight to Cloudinary the moment a photo is
 * added — well before the review is published, or even before the wizard reaches its last step.
 * A photo only gets a media_files row (and so counts as "referenced") once the review that used
 * it actually publishes; until then it's indistinguishable from someone still mid-wizard. This
 * grace period is what keeps an in-progress draft's photos safe from a cleanup run — only
 * something old enough that no realistic wizard session is still using it gets removed.
 */
export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Given everything Cloudinary has under the upload root and the storageKeys real media_files
 * rows reference, returns the assets that are neither referenced nor still within the grace
 * period — i.e. safe to delete.
 */
export function findOrphanedAssets(
	assets: UploadedAsset[],
	referencedStorageKeys: ReadonlySet<string>,
	now: Date,
	gracePeriodMs = GRACE_PERIOD_MS
): UploadedAsset[] {
	return assets.filter(
		(a) =>
			!referencedStorageKeys.has(a.publicId) &&
			now.getTime() - a.createdAt.getTime() > gracePeriodMs
	);
}
