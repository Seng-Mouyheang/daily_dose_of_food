import { describe, expect, it } from 'vitest';
import { findOrphanedAssets, type UploadedAsset } from './photoCleanupLogic.ts';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-10-08T12:00:00.000Z');

function asset(publicId: string, hoursAgo: number, bytes = 1000): UploadedAsset {
	return { publicId, createdAt: new Date(now.getTime() - hoursAgo * HOUR), bytes };
}

describe('findOrphanedAssets', () => {
	it('flags an old, unreferenced asset as orphaned', () => {
		const assets = [asset('a', 48)];
		expect(findOrphanedAssets(assets, new Set(), now)).toEqual(assets);
	});

	it('leaves a referenced asset alone no matter how old it is', () => {
		const assets = [asset('a', 48)];
		expect(findOrphanedAssets(assets, new Set(['a']), now)).toEqual([]);
	});

	it('leaves a recently-uploaded unreferenced asset alone (still within the grace period)', () => {
		const assets = [asset('a', 1)];
		expect(findOrphanedAssets(assets, new Set(), now)).toEqual([]);
	});

	it('is exclusive at the exact grace-period boundary', () => {
		const assets = [asset('a', 24)];
		expect(findOrphanedAssets(assets, new Set(), now, 24 * HOUR)).toEqual([]);
	});

	it('flags an asset one millisecond past the grace period', () => {
		const assets = [{ ...asset('a', 24), createdAt: new Date(now.getTime() - 24 * HOUR - 1) }];
		expect(findOrphanedAssets(assets, new Set(), now, 24 * HOUR)).toEqual(assets);
	});

	it('respects a custom grace period', () => {
		const assets = [asset('a', 2)];
		expect(findOrphanedAssets(assets, new Set(), now, HOUR)).toEqual(assets);
		expect(findOrphanedAssets(assets, new Set(), now, 3 * HOUR)).toEqual([]);
	});

	it('filters a mixed batch down to only the true orphans', () => {
		const oldUnreferenced = asset('old-unreferenced', 48);
		const oldReferenced = asset('old-referenced', 48);
		const freshUnreferenced = asset('fresh-unreferenced', 1);
		const assets = [oldUnreferenced, oldReferenced, freshUnreferenced];
		expect(findOrphanedAssets(assets, new Set(['old-referenced']), now)).toEqual([oldUnreferenced]);
	});

	it('returns an empty array when nothing is orphaned', () => {
		expect(findOrphanedAssets([], new Set(), now)).toEqual([]);
	});
});
