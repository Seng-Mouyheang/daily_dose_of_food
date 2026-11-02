<script lang="ts">
	/** One tile of the Explore grid: a 4:3 cover (the photo, or a tinted tile quoting the review
	 *  over a watermark of what was ordered), then the title, place, and a footer with the
	 *  author, the like count and — on someone else's review — a bookmark.
	 *
	 *  Mobile is the same card cut down (title over price, no author name, no Favorite badge);
	 *  the `lg:` classes build the desktop card on top, matching the grid's 2 → 3 columns.
	 *
	 *  The whole card opens the review through a stretched link, as ReviewCard does; like and
	 *  bookmark are lifted above it with `relative z-10`. The author is plain text for now:
	 *  there is no profile page to open yet. */
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { cardViewFromRow, type FeedReview } from '#lib/review/card.ts';
	import { createLike, createSave } from '#lib/review/engagement.svelte.ts';
	import { formatCount } from '#lib/review/format.ts';
	import { favoriteLabel, tileIcon, tileTint } from './explore.ts';

	let {
		review,
		href,
		timeAgo,
		signedIn
	}: {
		review: FeedReview & { isOwn: boolean };
		/** The review page, carrying `?from=` so its back link returns to this grid. */
		href: string;
		timeAgo: string;
		signedIn: boolean;
	} = $props();

	const view = $derived(cardViewFromRow(review, timeAgo, signedIn));
	const cover = $derived(view.photos[0] ?? null);

	const tintClass = { t1: 'bg-accent-soft', t2: 'bg-good-soft', t3: 'bg-sunken' };

	const like = createLike(() => ({
		reviewId: review.id,
		liked: review.viewerHasLiked,
		count: review.likeCount
	}));
	const save = createSave(() => ({ reviewId: review.id, saved: review.viewerHasSaved }));

	// 44px hit areas (DESIGN.md §7) that still sit in a compact footer: the negative margin
	// gives back the height the padding adds, so the row stays as short as the mockup.
	const actClass =
		'relative z-10 -my-2 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-1.5 tabular-nums transition-colors';
</script>

<article
	class="relative flex flex-col overflow-hidden rounded-card border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-card-lg"
>
	<div
		class="relative aspect-4/3 overflow-hidden {cover
			? 'bg-sunken'
			: tintClass[tileTint(review.id)]}"
	>
		{#if cover}
			<img
				src={cover.url}
				alt={view.title}
				loading="lazy"
				decoding="async"
				class="h-full w-full object-cover"
			/>
		{:else if view.description}
			<span class="absolute -right-2 -bottom-2 text-ink opacity-[.08] lg:-right-2.5 lg:-bottom-2.5">
				<Icon
					name={tileIcon(view.itemTypeLabel)}
					size={140}
					weight={1.2}
					class="size-[76px] lg:size-[140px]"
				/>
			</span>
			<p
				class="relative line-clamp-4 px-3 pt-[38px] text-[13px] leading-[1.55] text-ink-2 lg:px-6 lg:pt-14 lg:text-base"
			>
				“{view.description}”
			</p>
		{:else}
			<!-- Nothing to quote: the watermark alone, centred, rather than an empty tile. -->
			<span class="absolute inset-0 flex items-center justify-center text-ink opacity-[.12]">
				<Icon
					name={tileIcon(view.itemTypeLabel)}
					size={160}
					weight={1.2}
					class="size-[88px] lg:size-[160px]"
				/>
			</span>
		{/if}

		<span
			class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-badge px-1.75 py-0.75 text-xs font-bold text-on-badge tabular-nums lg:top-3 lg:right-3 lg:px-2.5 lg:py-1.25 lg:text-sm"
		>
			<svg
				viewBox="0 0 24 24"
				fill="currentColor"
				class="size-3 text-accent lg:size-3.5"
				aria-hidden="true"
			>
				<path d={STAR_PATH} />
			</svg>
			<span class="sr-only">Rated</span>
			{review.overallRating.toFixed(1)}
		</span>

		{#if review.isFavorite}
			<!-- on-photo-fav, not fav: white 12px text on it clears 4.5:1 over a photo and a tint
			     alike. Desktop only — on a 2-column phone grid it would cover half the cover. -->
			<span
				class="absolute top-3 left-3 hidden items-center gap-1.25 rounded-full bg-on-photo-fav px-2.5 py-1.25 text-xs font-bold tracking-[.03em] text-on-scrim lg:flex"
			>
				<Icon name="heart" size={12} weight={2.4} />
				{favoriteLabel(review.isOwn, review.author.displayName)}
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1 px-2.5 pt-2.5 pb-2 lg:gap-1.5 lg:px-4 lg:pt-3.5 lg:pb-3">
		<div class="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3">
			<h3
				class="min-w-0 font-display text-[15px] leading-tight font-semibold text-balance text-ink lg:text-lg"
			>
				{view.title}
			</h3>
			{#if view.price !== null}
				<span
					class="shrink-0 font-display text-sm font-semibold whitespace-nowrap text-ink tabular-nums lg:text-lg"
					>${view.price.toFixed(2)}</span
				>
			{/if}
		</div>

		<p class="flex min-w-0 items-center gap-1.25 text-xs text-ink-2 lg:text-[13px]">
			<Icon name="pin" size={14} class="text-ink-3" />
			<span class="truncate"
				>{view.placeName}{#if view.itemTypeLabel}
					· {view.itemTypeLabel}{/if}</span
			>
		</p>

		<footer
			class="mt-auto flex items-center gap-2 border-t border-line pt-2 text-[13px] font-semibold"
		>
			<Avatar
				src={review.author.avatarUrl}
				name={review.author.displayName}
				size={24}
				tone={review.isOwn ? 'accent' : 'soft'}
			/>
			<span class="min-w-0 flex-1 truncate">
				<span class="sr-only lg:not-sr-only">{review.author.displayName}</span>
				<span class="hidden font-normal text-ink-3 lg:inline">· {timeAgo}</span>
			</span>

			{#if signedIn}
				<button
					type="button"
					class="{actClass} {like.liked ? 'text-fav' : 'text-ink-2 hover:text-ink'}"
					aria-pressed={like.liked}
					aria-label={`Like, ${like.count} ${like.count === 1 ? 'like' : 'likes'}`}
					onclick={like.toggle}
				>
					<Icon name="heart" size={17} filled={like.liked} />
					<span>{formatCount(like.count)}</span>
				</button>
				{#if !review.isOwn}
					<button
						type="button"
						class="{actClass} {save.saved ? 'text-accent-strong' : 'text-ink-2 hover:text-ink'}"
						aria-pressed={save.saved}
						aria-label={save.saved ? 'Remove bookmark' : 'Bookmark'}
						onclick={save.toggle}
					>
						<Icon name="bookmark" size={17} filled={save.saved} />
					</button>
				{/if}
			{:else}
				<a
					href="/sign-in"
					class="{actClass} text-ink-2 hover:text-ink"
					aria-label={`Sign in to like, ${like.count} ${like.count === 1 ? 'like' : 'likes'}`}
				>
					<Icon name="heart" size={17} />
					<span>{formatCount(like.count)}</span>
				</a>
				<a
					href="/sign-in"
					class="{actClass} text-ink-2 hover:text-ink"
					aria-label="Sign in to bookmark"
				>
					<Icon name="bookmark" size={17} />
				</a>
			{/if}
		</footer>
	</div>

	<!-- Stretched link, as on ReviewCard: the whole card opens the review without wrapping the
	     like and bookmark controls in an anchor. The inset outline keeps the focus ring inside
	     the card's rounded, overflow-hidden edge. -->
	<a
		{href}
		class="absolute inset-0 rounded-card focus-visible:-outline-offset-2"
		aria-label={`Open review: ${view.title}`}
	></a>
</article>
