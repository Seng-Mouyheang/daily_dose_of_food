import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from '$app/env/private';

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET,
	secure: true
});

export { cloudinary };

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic';
const MAX_UPLOAD_BYTES = 12_000_000;

function uploadFolder(userId: string) {
	return `daily-dose-of-food/u/${userId}`;
}

/**
 * Signed params for a direct-to-Cloudinary upload, scoped to one user's own folder and
 * constrained to image formats/size. The browser must echo every signed param (timestamp,
 * folder, allowed_formats, max_file_size) back to Cloudinary's /image/upload endpoint
 * unchanged — Cloudinary recomputes the signature from whatever params it receives, so a
 * mismatch (or an extra/missing param) is rejected outright.
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
		allowed_formats: ALLOWED_FORMATS,
		max_file_size: MAX_UPLOAD_BYTES
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
