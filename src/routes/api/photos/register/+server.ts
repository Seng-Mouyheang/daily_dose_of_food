import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth.ts';
import {
	cloudinarySignatureValid,
	deliveryUrl,
	publicIdBelongsToUser
} from '#lib/server/cloudinary.ts';
import { db } from '#lib/server/db/index.ts';
import { mediaFiles } from '#lib/server/db/schema/index.ts';
import type { RequestHandler } from './$types';

const registerPhotoSchema = z.object({
	publicId: z.string().min(1),
	version: z.number().int().positive(),
	signature: z.string().min(1),
	format: z.string().nullable(),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	bytes: z.number().int().positive()
});

/**
 * Called right after a successful direct-to-Cloudinary upload (see Step3Photos.svelte), well
 * before the review it belongs to is anywhere near being published. Writes a `media_files` row
 * with `mediaStatus: 'pending'` so the asset counts as "referenced" the moment it exists —
 * publishReview later flips it to 'active'; if the draft is abandoned instead, the row stays
 * 'pending' and the asset ages out under `PENDING_UPLOAD_GRACE_PERIOD_MS` (see
 * photoCleanupLogic.ts) rather than the much shorter grace period a never-registered stray gets.
 * Best-effort from the caller's side: a failed/skipped call here only means this one photo falls
 * back to that shorter grace period, not a broken upload — see Step3Photos.svelte's call site.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = await requireUser(locals);

	const parsed = registerPhotoSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Malformed request.');
	const photo = parsed.data;

	if (!publicIdBelongsToUser(photo.publicId, user.id) || !cloudinarySignatureValid(photo)) {
		error(403, 'Photo failed verification.');
	}

	const [inserted] = await db
		.insert(mediaFiles)
		.values({
			ownerUserId: user.id,
			storageKey: photo.publicId,
			url: deliveryUrl(photo.publicId, photo.version, photo.format),
			format: photo.format,
			width: photo.width,
			height: photo.height,
			bytes: photo.bytes,
			mediaStatus: 'pending'
		})
		.onConflictDoNothing({ target: mediaFiles.storageKey })
		.returning({ mediaStatus: mediaFiles.mediaStatus });

	// onConflictDoNothing means a pre-existing row (almost always this same asset registered a
	// moment ago) silently won, not this insert — returning() comes back empty either way, so the
	// only way to tell "already pending/active, nothing to do" apart from "the orphan-cleanup job
	// already claimed this storageKey as deleted" (the narrow window where registration is late
	// enough that cleanup ran first) is to read back what's actually there now.
	if (!inserted) {
		const [existing] = await db
			.select({ mediaStatus: mediaFiles.mediaStatus })
			.from(mediaFiles)
			.where(eq(mediaFiles.storageKey, photo.publicId))
			.limit(1);
		if (existing?.mediaStatus === 'deleted') {
			error(409, 'This photo was already cleaned up — please re-upload it.');
		}
	}

	return json({ ok: true });
};
