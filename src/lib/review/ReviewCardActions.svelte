<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { formatCount } from './format.ts';

	/** Like / comments / save / share, as the handoff draws them.
	 *
	 *  Like and comments are real: the heart toggles through PUT/DELETE
	 *  /api/reviews/[id]/like, and both carry a count. Save and share stay deliberately inert —
	 *  there is no review_saves table yet, so there is nothing to toggle, and a handler that
	 *  silently drops the click would tell the user something false.
	 *
	 *  The like is optimistic: the heart and count flip immediately, then snap to whatever the
	 *  server says it settled on, and roll back if the request fails. Every control that must stay
	 *  clickable above a card's stretched link is lifted with `relative z-10`. */
	let {
		reviewId = null,
		liked = false,
		likeCount = 0,
		commentCount = 0,
		commentsHref = null,
		canLike = false
	}: {
		reviewId?: string | null;
		liked?: boolean;
		likeCount?: number;
		commentCount?: number;
		commentsHref?: string | null;
		canLike?: boolean;
	} = $props();

	// Writable $derived: follows the props, but can be assigned to for the optimistic update. It
	// snaps back to the props when the parent hands over fresh data (a navigation, an
	// invalidation), and — unlike an $effect-seeded $state — is correct on the first render.
	let isLiked = $derived(liked);
	let count = $derived(likeCount);
	let pending = $state(false);
	// True only while the pop plays, and only set by a click that *adds* a like — so a card that
	// loads already liked, or an unlike, doesn't animate.
	let popping = $state(false);

	async function toggleLike() {
		if (!reviewId || pending) return;
		pending = true;
		const before = { isLiked, count };
		isLiked = !before.isLiked;
		popping = isLiked;
		count = Math.max(0, before.count + (isLiked ? 1 : -1));

		try {
			const res = await fetch(`/api/reviews/${reviewId}/like`, {
				method: isLiked ? 'PUT' : 'DELETE'
			});
			if (!res.ok) throw new Error(String(res.status));
			// The write has committed by now; an unreadable body keeps the optimistic state rather than
			// rolling back to one the database no longer has.
			const settled: { liked: boolean; likeCount: number } | null = await res
				.json()
				.catch(() => null);
			if (settled) {
				isLiked = settled.liked;
				count = settled.likeCount;
			}
			// The hover-preloaded review page (data-sveltekit-preload-data) was fetched before this
			// like and would be reused on click, showing the old state until a refresh. Any
			// invalidation discards that preload; no load depends on this key, so nothing re-runs.
			void invalidate('app:review-engagement');
		} catch {
			isLiked = before.isLiked;
			count = before.count;
		} finally {
			pending = false;
		}
	}

	const buttonClass =
		'relative z-10 inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold tabular-nums transition-colors';
</script>

<div class="-mx-2.5 flex items-center gap-0.5 border-t border-line pt-2">
	{#if !reviewId}
		<IconButton icon="heart" label="Like — not available yet" inert />
	{:else if canLike}
		<button
			type="button"
			class={`${buttonClass} ${isLiked ? 'text-fav' : 'text-ink-2 hover:text-ink'}`}
			aria-pressed={isLiked}
			aria-label={`Like, ${count} ${count === 1 ? 'like' : 'likes'}`}
			onclick={toggleLike}
		>
			<span class="inline-flex" class:pop={popping} onanimationend={() => (popping = false)}>
				<Icon name="heart" filled={isLiked} />
			</span>
			{#if count > 0}<span>{formatCount(count)}</span>{/if}
		</button>
	{:else}
		<a
			href="/sign-in"
			class={`${buttonClass} text-ink-2 hover:text-ink`}
			aria-label={`Sign in to like, ${count} ${count === 1 ? 'like' : 'likes'}`}
		>
			<Icon name="heart" />
			{#if count > 0}<span>{formatCount(count)}</span>{/if}
		</a>
	{/if}

	{#if commentsHref}
		<a
			href={commentsHref}
			class={`${buttonClass} text-ink-2 hover:text-ink`}
			aria-label={`Comments, ${commentCount}`}
		>
			<Icon name="comment" />
			{#if commentCount > 0}<span>{formatCount(commentCount)}</span>{/if}
		</a>
	{:else}
		<IconButton icon="comment" label="Comments — not available yet" inert />
	{/if}
	<span class="flex-1"></span>
	<IconButton icon="bookmark" label="Save — not available yet" inert />
	<IconButton icon="share" label="Share — not available yet" inert />
</div>

<style>
	/* A quick overshoot, like pressing the heart: swell, dip under, settle. Kept short so a
	   rapid like/unlike/like never feels sluggish. Reduced motion is handled globally in
	   layout.css, which zeroes animation durations. */
	.pop {
		animation: pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes pop {
		0% {
			transform: scale(1);
		}
		35% {
			transform: scale(1.4);
		}
		65% {
			transform: scale(0.9);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
