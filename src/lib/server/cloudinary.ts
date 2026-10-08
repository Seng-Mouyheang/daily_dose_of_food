import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from '$app/env/private';
import type { UploadedAsset } from './photoCleanupLogic.ts';

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET,
	secure: true
});

export { cloudinary };

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic';
/** Root folder every user's uploads live under — see uploadFolder. Shared with photoCleanup.ts,
 *  which lists everything under here to find assets no review ever ended up referencing. */
export const UPLOAD_ROOT_PREFIX = 'daily-dose-of-food/u/';

function uploadFolder(userId: string) {
	return `${UPLOAD_ROOT_PREFIX}${userId}`;
}

/**
 * Signed params for a direct-to-Cloudinary upload, scoped to one user's own folder and
 * constrained to image formats. The browser must echo every signed param (timestamp, folder,
 * allowed_formats) back to Cloudinary's /image/upload endpoint unchanged — Cloudinary
 * recomputes the signature from whatever params it receives, so a mismatch (or an extra/missing
 * param) is rejected outright. `max_file_size` deliberately isn't one of these: it isn't a
 * parameter Cloudinary's upload API recognizes, so including it in what we sign made our
 * locally-computed signature diverge from the one Cloudinary verifies against (which only ever
 * covered the params it actually knows about) — every real upload was rejected with "Invalid
 * Signature". The 12 MB limit is enforced client-side instead (see Step3Photos.svelte).
 *
 * This bounds what a signed-in user can upload, but the result is still their *claim* about
 * what they uploaded until cloudinarySignatureValid re-verifies it server-side against the
 * response Cloudinary actually signed.
 */
export function signUpload(userId: string) {
	const timestamp = Math.round(Date.now() / 1000);
	const folder = uploadFolder(userId);
	const params = {
		timestamp,
		folder,
		allowed_formats: ALLOWED_FORMATS
	};
	const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET);
	return {
		...params,
		signature,
		apiKey: CLOUDINARY_API_KEY,
		cloudName: CLOUDINARY_CLOUD_NAME
	};
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Re-signs {public_id, version} with our API secret and compares it to the signature
 * Cloudinary returned for that upload. A match proves the asset really exists with exactly
 * that public_id and version — the cheapest way to confirm a publish payload's photo claims
 * are real, since Cloudinary already computed this signature for us at upload time. It does
 * not confirm width/height/bytes/format, which stay cosmetic until a moderation pass checks them.
 */
export function cloudinarySignatureValid(photo: {
	publicId: string;
	version: number;
	signature: string;
}): boolean {
	const expected = cloudinary.utils.api_sign_request(
		{ public_id: photo.publicId, version: photo.version },
		CLOUDINARY_API_SECRET
	);
	return timingSafeEqual(expected, photo.signature);
}

/** Guards against a user submitting someone else's (or a stale) public_id from outside their
 *  own upload folder — signUpload only ever issues ids under this prefix for this user. */
export function publicIdBelongsToUser(publicId: string, userId: string): boolean {
	return publicId.startsWith(`${uploadFolder(userId)}/`);
}

/** The delivery URL media_files.url stores for a Cloudinary asset — shared by publishReview and
 *  the upload-registration endpoint so both ever only reconstruct it one way. quality/fetch_format
 *  'auto' ask Cloudinary to serve a compressed, next-gen format (WebP/AVIF) per-request based on
 *  the requesting browser — the stored original is untouched, this only affects what gets
 *  delivered. format still pins the URL's file extension; f_auto overrides the actual served
 *  format regardless of that extension. */
export function deliveryUrl(storageKey: string, version: number, format: string | null): string {
	return cloudinary.url(storageKey, {
		secure: true,
		version,
		format: format ?? undefined,
		fetch_format: 'auto',
		quality: 'auto'
	});
}

/** Lists every asset Cloudinary has under UPLOAD_ROOT_PREFIX (i.e. every user's upload folder),
 *  paginating through next_cursor — for photoCleanup.ts to diff against media_files and find
 *  ones no review ever ended up referencing. Admin API call, not scoped to one user. */
export async function listUploadedAssets(): Promise<UploadedAsset[]> {
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

/** Permanently deletes the given Cloudinary assets, batching to the Admin API's 100-per-call
 *  limit. Irreversible — callers must already be sure these are safe to remove. */
export async function destroyAssets(publicIds: string[]): Promise<void> {
	const batches: string[][] = [];
	for (let i = 0; i < publicIds.length; i += 100) batches.push(publicIds.slice(i, i + 100));
	await Promise.all(batches.map((batch) => cloudinary.api.delete_resources(batch)));
}
