/**
 * Direct-to-Cloudinary photo upload, shared by the review wizard and comments: sign on our
 * server, upload straight from the browser to Cloudinary, then register the result so it gets a
 * `media_files` row (`mediaStatus: 'pending'`) until something that uses it is published.
 */

export const ACCEPTED_IMAGE = /^image\/(png|jpe?g|webp|heic)$/;
// Cloudinary's upload API has no `max_file_size` request param (see signUpload's doc comment in
// cloudinary.ts for how including one as a signed param broke every upload), so the 12 MB
// ceiling is enforced here instead, before anything uploads.
export const MAX_UPLOAD_BYTES = 12_000_000;

export interface SignedParams {
	timestamp: number;
	folder: string;
	allowed_formats: string;
	signature: string;
	apiKey: string;
	cloudName: string;
}

/** What Cloudinary hands back, trimmed to the fields we keep. */
export interface UploadedPhoto {
	publicId: string;
	version: number;
	signature: string;
	format: string;
	width: number;
	height: number;
	bytes: number;
	secureUrl: string;
}

export async function signUploadParams(): Promise<SignedParams> {
	const res = await fetch('/api/upload-signature', { method: 'POST' });
	if (!res.ok) throw new Error('Could not sign upload');
	return res.json();
}

export async function uploadToCloudinary(file: File, signed: SignedParams): Promise<UploadedPhoto> {
	const form = new FormData();
	form.append('file', file);
	form.append('api_key', signed.apiKey);
	form.append('timestamp', String(signed.timestamp));
	form.append('signature', signed.signature);
	form.append('folder', signed.folder);
	form.append('allowed_formats', signed.allowed_formats);

	const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
		method: 'POST',
		body: form
	});
	if (!res.ok) throw new Error('Upload failed');
	const data = await res.json();
	return {
		publicId: data.public_id,
		version: data.version,
		signature: data.signature,
		format: data.format,
		width: data.width,
		height: data.height,
		bytes: data.bytes,
		secureUrl: data.secure_url
	};
}

/** Registers an upload server-side (see /api/photos/register). Resolves to whether it worked. */
export async function registerPhoto(photo: UploadedPhoto): Promise<boolean> {
	const { publicId, version, signature, format, width, height, bytes } = photo;
	const res = await fetch('/api/photos/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ publicId, version, signature, format, width, height, bytes })
	}).catch(() => null);
	return res?.ok ?? false;
}
