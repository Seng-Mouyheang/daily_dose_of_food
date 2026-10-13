<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { formatCount } from './format.ts';

	/** Like / comments / save / share, as the handoff draws them.
	 *
	 *  The heart toggles through PUT/DELETE /api/reviews/[id]/like and the bookmark through
	 *  /api/reviews/[id]/save; like and comments carry a count, a save is private and doesn't.
	 *  Share needs no server: a small menu of copy-link and share-intent links, plus the native
	 *  share sheet as "More…" on devices that have one.
	 *
	 *  Like and save are optimistic: they flip immediately, then snap to whatever the server says
	 *  it settled on, and roll back if the request fails. Every control that must stay
	 *  clickable above a card's stretched link is lifted with `relative z-10`. */
	let {
		reviewId = null,
		liked = false,
		saved = false,
		shareTitle = '',
		likeCount = 0,
		commentCount = 0,
		commentsHref = null,
		canLike = false
	}: {
		reviewId?: string | null;
		liked?: boolean;
		saved?: boolean;
		shareTitle?: string;
		likeCount?: number;
		commentCount?: number;
		commentsHref?: string | null;
		/** Signed in — gates save as well as like. */
		canLike?: boolean;
	} = $props();

	/** The shape behind both the heart and the bookmark: PUT/DELETE depending on `on`, then
	 *  either apply whatever the server settled on or roll back. `flip` and `rollback` own the
	 *  optimistic state themselves — a like also carries a count, a save doesn't — so this stays
	 *  agnostic to what's being toggled. The hover-preloaded review page
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

		await toggleEngagement<{ liked: boolean; likeCount: number }>(
			`/api/reviews/${reviewId}/like`,
			isLiked,
			(settled) => {
				if (settled) {
					isLiked = settled.liked;
					count = settled.likeCount;
				}
			},
			() => {
				isLiked = before.isLiked;
				count = before.count;
			}
		);
		pending = false;
	}

	let isSaved = $derived(saved);
	let savePending = $state(false);
	// Same rule as the heart's popping: only a click that *adds* a save plays the animation.
	let savePopping = $state(false);

	async function toggleSave() {
		if (!reviewId || savePending) return;
		savePending = true;
		const before = isSaved;
		isSaved = !before;
		savePopping = isSaved;

		await toggleEngagement<{ saved: boolean }>(
			`/api/reviews/${reviewId}/save`,
			isSaved,
			(settled) => {
				if (settled) isSaved = settled.saved;
			},
			() => {
				isSaved = before;
			}
		);
		savePending = false;
	}

	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	let menu = $state<HTMLElement>();
	const shareUrl = $derived(`${page.url.origin}/review/${reviewId}`);
	// False during SSR, where there is no `navigator.share` to check; true once hydrated on a
	// device with a share sheet.
	const canNativeShare = $derived(typeof navigator !== 'undefined' && 'share' in navigator);

	/** Share-intent URLs; each opens in a new tab, so they are plain links and need no script. */
	const targets = $derived.by(() => {
		const url = encodeURIComponent(shareUrl);
		const text = encodeURIComponent(shareTitle);
		return [
			{ label: 'X', icon: 'x' as const, href: `https://x.com/intent/post?url=${url}&text=${text}` },
			{
				label: 'Facebook',
				icon: 'facebook' as const,
				href: `https://www.facebook.com/sharer/sharer.php?u=${url}`
			},
			{
				label: 'Telegram',
				icon: 'send' as const,
				href: `https://t.me/share/url?url=${url}&text=${text}`
			},
			{
				label: 'WhatsApp',
				icon: 'whatsapp' as const,
				href: `https://wa.me/?text=${text}%20${url}`
			}
		];
	});

	async function copyLink() {
		menu?.hidePopover();
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard blocked (insecure context, denied permission): nothing useful to show.
		}
	}

	async function nativeShare() {
		menu?.hidePopover();
		// A dismissed sheet rejects with AbortError; there is nothing to recover.
		await navigator.share({ title: shareTitle || undefined, url: shareUrl }).catch(() => {});
	}

	const itemClass = 'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-sunken';

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
	{#if !reviewId}
		<IconButton icon="bookmark" label="Save — not available yet" inert />
		<IconButton icon="share" label="Share — not available yet" inert />
	{:else}
		{#if canLike}
			<button
				type="button"
				class={`${buttonClass} ${isSaved ? 'text-accent' : 'text-ink-2 hover:text-ink'}`}
				aria-pressed={isSaved}
				aria-label={isSaved ? 'Saved' : 'Save'}
				onclick={toggleSave}
			>
				<span
					class="inline-flex"
					class:pop={savePopping}
					onanimationend={() => (savePopping = false)}
				>
					<Icon name="bookmark" filled={isSaved} />
				</span>
			</button>
		{:else}
			<a
				href="/sign-in"
				class={`${buttonClass} text-ink-2 hover:text-ink`}
				aria-label="Sign in to save"
			>
				<Icon name="bookmark" />
			</a>
		{/if}
		<button
			type="button"
			popovertarget="share-{reviewId}"
			class={`${buttonClass} text-ink-2 hover:text-ink`}
			aria-label="Share"
			style="anchor-name: --share-{reviewId}"
		>
			<Icon name={copied ? 'check' : 'share'} />
			{#if copied}<span class="text-xs font-medium">Link copied</span>{/if}
		</button>
		<div
			bind:this={menu}
			id="share-{reviewId}"
			popover
			class="anchored-menu anchored-menu-up min-w-44 rounded-input border border-line bg-surface p-1 text-sm text-ink shadow-card-lg"
			style="position-anchor: --share-{reviewId}"
		>
			<button type="button" class={itemClass} onclick={copyLink}>
				<Icon name="link" size={16} />Copy link
			</button>
			{#each targets as target (target.label)}
				<a
					href={target.href}
					target="_blank"
					rel="noopener noreferrer"
					class={itemClass}
					onclick={() => menu?.hidePopover()}
				>
					<Icon name={target.icon} size={16} />{target.label}
				</a>
			{/each}
			{#if canNativeShare}
				<button type="button" class={itemClass} onclick={nativeShare}>
					<Icon name="more" size={16} />More…
				</button>
			{/if}
		</div>
		<span class="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
	{/if}
</div>

<style>
	/* The share menu's own positioning (opening upward and leftward) comes from the
	   `.anchored-menu`/`.anchored-menu-up` utilities in layout.css, shared with CommentItem's
	   "more" menu. */

	/* A quick overshoot, shared by the heart and the bookmark: swell, dip under, settle. Kept
	   short so a rapid like/unlike or save/unsave never feels sluggish. Reduced motion is
	   handled globally in layout.css, which zeroes animation durations. */
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
