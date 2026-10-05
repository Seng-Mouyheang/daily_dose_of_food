import { describe, expect, it } from 'vitest';
import {
	cloudinary,
	cloudinarySignatureValid,
	publicIdBelongsToUser,
	signUpload
} from './cloudinary.ts';

describe('cloudinarySignatureValid', () => {
	it('accepts a signature Cloudinary itself would compute for the same public_id/version', () => {
		const publicId = 'daily-dose-of-food/u/user-1/abc123';
		const version = 1700000000;
		const signature = cloudinary.utils.api_sign_request(
			{ public_id: publicId, version },
			// Same secret cloudinary.ts configured itself from $app/env/private, so this
			// reproduces exactly what a real Cloudinary upload response would contain.
			cloudinary.config().api_secret!
		);
		expect(cloudinarySignatureValid({ publicId, version, signature })).toBe(true);
	});

	it('rejects a tampered public_id', () => {
		const version = 1700000000;
		const signature = cloudinary.utils.api_sign_request(
			{ public_id: 'daily-dose-of-food/u/user-1/abc123', version },
			cloudinary.config().api_secret!
		);
		expect(
			cloudinarySignatureValid({
				publicId: 'daily-dose-of-food/u/user-1/other',
				version,
				signature
			})
		).toBe(false);
	});

	it('rejects a tampered version', () => {
		const publicId = 'daily-dose-of-food/u/user-1/abc123';
		const signature = cloudinary.utils.api_sign_request(
			{ public_id: publicId, version: 1700000000 },
			cloudinary.config().api_secret!
		);
		expect(cloudinarySignatureValid({ publicId, version: 1700000001, signature })).toBe(false);
	});
});

describe('publicIdBelongsToUser', () => {
	it('accepts an id under that user’s own folder', () => {
		expect(publicIdBelongsToUser('daily-dose-of-food/u/user-1/abc', 'user-1')).toBe(true);
	});

	it('rejects an id under a different user’s folder', () => {
		expect(publicIdBelongsToUser('daily-dose-of-food/u/user-2/abc', 'user-1')).toBe(false);
	});

	it('rejects an id with no folder at all', () => {
		expect(publicIdBelongsToUser('abc', 'user-1')).toBe(false);
	});
});

describe('signUpload', () => {
	it('scopes the folder to the given user id', () => {
		expect(signUpload('user-1').folder).toBe('daily-dose-of-food/u/user-1');
	});

	it('produces a signature that verifies against the same params', () => {
		const signed = signUpload('user-1');
		const { signature, apiKey, cloudName, ...params } = signed;
		const expected = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret!);
		expect(signature).toBe(expected);
		expect(apiKey).toBeTruthy();
		expect(cloudName).toBeTruthy();
	});
});
