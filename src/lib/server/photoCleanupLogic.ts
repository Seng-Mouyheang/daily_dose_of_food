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
 * How long to leave a freshly-uploaded photo alone before it's eligible for cleanup, when it has
 * no media_files row at all yet (e.g. the register-pending-upload call below never landed). Step
 * 3 of the review wizard (Step3Photos.svelte) uploads straight to Cloudinary the moment a photo
 * is added — well before the review is published, or even before the wizard reaches its last
 * step — so a brand new, row-less asset is indistinguishable from someone still mid-upload.
 */
export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * How long to leave a photo alone once it has a media_files row with `mediaStatus: 'pending'` —
 * i.e. the upload was registered (see `/api/photos/register`) but the review it belongs to was
 * never published, whether because the reviewer is still mid-wizard or abandoned the draft
 * outright. Drafts live only in the browser's localStorage with no expiry of their own, so this
 * is deliberately generous — long enough that no realistic in-progress draft gets caught, while
 * still eventually reclaiming storage from a draft that's truly never coming back. A row whose
 * status is anything other than 'pending' (i.e. its review published) is never orphaned,
 * regardless of age — see findOrphanedAssets.
 */
export const PENDING_UPLOAD_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Given everything Cloudinary has under the upload root, the storageKeys of media_files rows
 * that are NOT merely a pending upload registration (i.e. their review published, or any other
 * non-pending status — these are never orphaned regardless of age), and the storageKeys of rows
 * that ARE still just a pending registration (orphaned once older than pendingGracePeriodMs),
 * returns the assets that are safe to delete: no row at all and past gracePeriodMs, or a pending
 * row and past pendingGracePeriodMs.
 */
export function findOrphanedAssets(
	assets: UploadedAsset[],
	referencedStorageKeys: ReadonlySet<string>,
	now: Date,
	gracePeriodMs = GRACE_PERIOD_MS,
	pendingStorageKeys: ReadonlySet<string> = new Set(),
	pendingGracePeriodMs = PENDING_UPLOAD_GRACE_PERIOD_MS
): UploadedAsset[] {
	return assets.filter((a) => {
		if (referencedStorageKeys.has(a.publicId)) return false;
		const age = now.getTime() - a.createdAt.getTime();
		if (pendingStorageKeys.has(a.publicId)) return age > pendingGracePeriodMs;
		return age > gracePeriodMs;
	});
}
