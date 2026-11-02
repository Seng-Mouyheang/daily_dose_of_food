<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { createLike, createSave } from './engagement.svelte.ts';
	import { formatCount } from './format.ts';

	/** Like / comments / save / share, as the handoff draws them.
	 *
	 *  The heart toggles through PUT/DELETE /api/reviews/[id]/like and the bookmark through
	 *  /api/reviews/[id]/save; like and comments carry a count, a save is private and doesn't.
	 *  Share needs no server: a small menu of copy-link and share-intent links, plus the native
	 *  share sheet as "More…" on devices that have one.
	 *
	 *  Like and save are optimistic (see engagement.svelte.ts). Every control that must stay
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

	// A per-instance id for the share popover's anchor/target pair — not `reviewId`, which is
	// app data, not a DOM identity: two cards for the same review (unlikely, but not ruled out
	// by anything here) would otherwise fight over one `anchor-name` and one popover `id`.
	const uid = $props.id();

	const like = createLike(() => ({ reviewId, liked, count: likeCount }));
	const save = createSave(() => ({ reviewId, saved }));

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
			class={`${buttonClass} ${like.liked ? 'text-fav' : 'text-ink-2 hover:text-ink'}`}
			aria-pressed={like.liked}
			aria-label={`Like, ${like.count} ${like.count === 1 ? 'like' : 'likes'}`}
			onclick={like.toggle}
		>
			<span
				class="inline-flex"
				class:pop={like.popping}
				onanimationend={() => (like.popping = false)}
			>
				<Icon name="heart" filled={like.liked} />
			</span>
			{#if like.count > 0}<span>{formatCount(like.count)}</span>{/if}
		</button>
	{:else}
		<a
			href="/sign-in"
			class={`${buttonClass} text-ink-2 hover:text-ink`}
			aria-label={`Sign in to like, ${like.count} ${like.count === 1 ? 'like' : 'likes'}`}
		>
			<Icon name="heart" />
			{#if like.count > 0}<span>{formatCount(like.count)}</span>{/if}
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
				class={`${buttonClass} ${save.saved ? 'text-accent' : 'text-ink-2 hover:text-ink'}`}
				aria-pressed={save.saved}
				aria-label={save.saved ? 'Saved' : 'Save'}
				onclick={save.toggle}
			>
				<span
					class="inline-flex"
					class:pop={save.popping}
					onanimationend={() => (save.popping = false)}
				>
					<Icon name="bookmark" filled={save.saved} />
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
			popovertarget="share-{uid}"
			class={`${buttonClass} text-ink-2 hover:text-ink`}
			aria-label="Share"
			style="anchor-name: --share-{uid}"
		>
			<Icon name={copied ? 'check' : 'share'} />
			{#if copied}<span class="text-xs font-medium">Link copied</span>{/if}
		</button>
		<div
			bind:this={menu}
			id="share-{uid}"
			popover
			class="anchored-menu anchored-menu-up min-w-44 rounded-input border border-line bg-surface p-1 text-sm text-ink shadow-card-lg"
			style="position-anchor: --share-{uid}"
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
