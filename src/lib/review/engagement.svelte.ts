import { invalidate } from '$app/navigation';

/** The optimistic like and save toggles behind every review card (the feed's action row and the
 *  Explore grid's footer), and the Follow button on Explore's people rows. Each flips immediately, then snaps to whatever the server says it
 *  settled on, and rolls back if the request fails.
 *
 *  Both take a getter rather than values, so the state follows the card's props: a writable
 *  $derived is correct on the first render and snaps back to the props when the parent hands
 *  over fresh data (a navigation, an invalidation). */

/** The shape behind both the heart and the bookmark: PUT/DELETE depending on `on`, then either
 *  apply whatever the server settled on or roll back. The hover-preloaded review page
 *  (data-sveltekit-preload-data) was fetched before this write and would be reused on click,
 *  showing the old state until a refresh; the invalidation discards that preload (no load
 *  depends on this key, so nothing re-runs). */
async function toggleEngagement<Settled>(
	endpoint: string,
	on: boolean,
	applySettled: (body: Settled | null) => void,
	rollback: () => void
): Promise<void> {
	try {
		const res = await fetch(endpoint, { method: on ? 'PUT' : 'DELETE' });
		if (!res.ok) throw new Error(String(res.status));
		applySettled(await res.json().catch(() => null));
		void invalidate('app:review-engagement');
	} catch {
		rollback();
	}
}

export function createLike(read: () => { reviewId: string | null; liked: boolean; count: number }) {
	let liked = $derived(read().liked);
	let count = $derived(read().count);
	let pending = false;
	// True only while the pop plays, and only set by a click that *adds* a like — so a card that
	// loads already liked, or an unlike, doesn't animate.
	let popping = $state(false);

	async function toggle() {
		const { reviewId } = read();
		if (!reviewId || pending) return;
		pending = true;
		const before = { liked, count };
		liked = !before.liked;
		popping = liked;
		count = Math.max(0, before.count + (liked ? 1 : -1));

		await toggleEngagement<{ liked: boolean; likeCount: number }>(
			`/api/reviews/${reviewId}/like`,
			liked,
			(settled) => {
				if (settled) {
					liked = settled.liked;
					count = settled.likeCount;
				}
			},
			() => {
				liked = before.liked;
				count = before.count;
			}
		);
		pending = false;
	}

	return {
		get liked() {
			return liked;
		},
		get count() {
			return count;
		},
		get popping() {
			return popping;
		},
		set popping(value: boolean) {
			popping = value;
		},
		toggle
	};
}

/** An on/off toggle behind one endpoint (a bookmark, a follow): flips at once, then snaps to
 *  the server's `field` or rolls back. No endpoint (a review not published yet) is a no-op. */
function createToggle(read: () => { endpoint: string | null; on: boolean }, field: string) {
	let on = $derived(read().on);
	let pending = false;
	// Same rule as the heart's popping: only a click that *turns it on* plays the animation.
	let popping = $state(false);

	async function toggle() {
		const { endpoint } = read();
		if (!endpoint || pending) return;
		pending = true;
		const before = on;
		on = !before;
		popping = on;

		await toggleEngagement<Record<string, boolean>>(
			endpoint,
			on,
			(settled) => {
				if (settled) on = settled[field];
			},
			() => {
				on = before;
			}
		);
		pending = false;
	}

	return {
		get on() {
			return on;
		},
		get popping() {
			return popping;
		},
		set popping(value: boolean) {
			popping = value;
		},
		toggle
	};
}

export const createSave = (read: () => { reviewId: string | null; saved: boolean }) =>
	createToggle(() => {
		const { reviewId, saved } = read();
		return { endpoint: reviewId && `/api/reviews/${reviewId}/save`, on: saved };
	}, 'saved');

export const createFollow = (read: () => { userId: string; following: boolean }) =>
	createToggle(() => {
		const { userId, following } = read();
		return { endpoint: `/api/users/${userId}/follow`, on: following };
	}, 'following');
