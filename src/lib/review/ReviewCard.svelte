<script lang="ts">
	/** The review card, used in three places: the wizard's live preview, the home feed, and the
	 *  review page's own "more from this place" style surfaces later. It renders a
	 *  ReviewCardView and nothing else — every "which name wins", "is this tag positive",
	 *  "what is the average" question is answered by the adapters in card.ts, so this file is
	 *  only layout. See card.ts for why that split exists.
	 *
	 *  `view.href` is the discriminator between a published card and the preview: a published
	 *  card is a link to the review and carries the action row; the preview is inert and
	 *  carries a visit-date + visibility footer instead. */
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { splitTags, type ReviewCardView } from './card.ts';
	import ReviewCardActions from './ReviewCardActions.svelte';
	import { formatVisitDate } from './format.ts';

	let { view }: { view: ReviewCardView } = $props();

	const cover = $derived(view.photos[0] ?? null);

	// Grouped positive-then-negative rather than publish order, so the card never interleaves
	// "Friendly staff" and "Slow service" side by side. The handoff caps it at three tags, with
	// a "+N more" button to reveal the rest in place — a real button (not the card's stretched
	// link) so clicking it expands the tags instead of opening the review.
	const orderedTags = $derived.by(() => {
		const { positive, negative } = splitTags(view.tags);
		return [...positive, ...negative];
	});
	let tagsExpanded = $state(false);
	const visibleTags = $derived(tagsExpanded ? orderedTags : orderedTags.slice(0, 3));
	const hiddenTagCount = $derived(
		tagsExpanded ? 0 : Math.max(0, orderedTags.length - visibleTags.length)
	);

	const visibilityLabel: Record<string, string> = {
		public: 'Public',
		friends: 'Friends',
		private: 'Only me'
	};
	const visibilityIcon: Record<string, 'globe' | 'users' | 'lock'> = {
		public: 'globe',
		friends: 'users',
		private: 'lock'
	};
</script>

<article
	class="relative overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow {view.href
		? 'hover:shadow-card-lg'
		: ''}"
>
	<header class="flex items-center gap-3 py-3.5 pr-2 pl-4">
		<Avatar src={view.author.avatarUrl} name={view.author.displayName} size={40} />
		<div class="min-w-0 flex-1">
			<p class="text-[15px] font-bold text-ink">
				{view.author.displayName}
				{#if view.timeAgo}<span class="text-[13px] font-normal text-ink-3">· {view.timeAgo}</span
					>{/if}
			</p>
			<p class="truncate text-[13px] text-ink-2">
				{view.placeName} · {view.visitLabel}{#if view.itemTypeLabel}
					· {view.itemTypeLabel}{/if}
			</p>
		</div>
		{#if view.href}
			<!-- z-10 keeps this above the stretched link below, so it stays its own control
			     rather than another way to open the review. -->
			<span class="relative z-10">
				<IconButton icon="more" label="More options — not available yet" inert />
			</span>
		{/if}
	</header>

	<!-- No photos means no photo block at all. An empty 16:10 placeholder is a large grey hole
	     in the middle of the feed, so the score and Favorite badge move under the title
	     instead (see below) and the card simply gets shorter. -->
	{#if cover}
		<div class="relative aspect-16/10 overflow-hidden bg-sunken">
			<img src={cover.url} alt={cover.caption ?? ''} class="h-full w-full object-cover" />
			{#if view.overallRating !== null}
				<span
					class="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-badge px-2.5 py-1.25 text-sm font-bold text-on-badge tabular-nums"
				>
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="text-accent"
						aria-hidden="true"
					>
						<path d={STAR_PATH} />
					</svg>
					{view.overallRating.toFixed(1)}
				</span>
			{/if}
			{#if view.isFavorite}
				<span
					class="absolute top-3 left-3 flex items-center gap-1.25 rounded-full bg-on-photo-fav px-2.5 py-1.25 text-xs font-bold tracking-[.03em] text-on-scrim uppercase"
				>
					<Icon name="heart" size={13} />
					Favorite
				</span>
			{/if}
			{#if view.photos.length > 1}
				<span
					class="absolute right-3 bottom-3 rounded-full bg-scrim px-2.25 py-0.75 text-xs font-semibold text-on-scrim"
				>
					1/{view.photos.length}
				</span>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-2.5 px-4 pt-3.5 pb-2.5">
		<div class="flex items-baseline justify-between gap-3">
			<h3 class="font-display text-xl leading-tight font-semibold text-balance text-ink">
				{view.title}
			</h3>
			{#if view.price !== null}
				<span class="shrink-0 font-display text-lg font-semibold text-ink tabular-nums"
					>${view.price.toFixed(2)}</span
				>
			{/if}
		</div>

		{#if !cover && (view.overallRating !== null || view.isFavorite)}
			<div class="flex items-center gap-2">
				{#if view.overallRating !== null}
					<Stars value={view.overallRating} size={16} />
					<span class="text-sm font-bold text-ink tabular-nums">
						{view.overallRating.toFixed(1)}
					</span>
				{/if}
				{#if view.isFavorite}
					<span
						class="flex items-center gap-1 rounded-full bg-fav-soft px-2.25 py-0.75 text-xs font-bold text-fav"
					>
						<Icon name="heart" size={12} />
						Favorite
					</span>
				{/if}
			</div>
		{/if}

		{#if view.tags.length}
			<div class="flex flex-wrap gap-1.25">
				{#each visibleTags as tag, i (i)}
					<span
						class="inline-flex h-6.5 items-center rounded-full px-2.25 text-xs font-medium whitespace-nowrap {tag.sentiment ===
						'positive'
							? 'bg-good-soft text-good'
							: 'bg-bad-soft text-bad'}"
					>
						<span class="sr-only"
							>{tag.sentiment === 'positive' ? 'Good: ' : 'Could be better: '}</span
						>{tag.label}
					</span>
				{/each}
				{#if hiddenTagCount}
					<!-- relative z-10 lifts this above the stretched link below, so it expands the
					     tags in place instead of opening the review. -->
					<button
						type="button"
						class="relative z-10 inline-flex h-6.5 items-center rounded-full border border-line bg-surface px-2.25 text-xs font-medium whitespace-nowrap text-ink-2 hover:border-ink-3"
						onclick={() => (tagsExpanded = true)}
					>
						+{hiddenTagCount} more
					</button>
				{:else if tagsExpanded}
					<button
						type="button"
						class="relative z-10 inline-flex h-6.5 items-center rounded-full border border-line bg-surface px-2.25 text-xs font-medium whitespace-nowrap text-ink-2 hover:border-ink-3"
						onclick={() => (tagsExpanded = false)}
					>
						Show less
					</button>
				{/if}
			</div>
		{/if}

		{#if view.description}
			<p class="line-clamp-3 text-sm leading-normal text-ink-2">{view.description}</p>
		{/if}

		{#if view.href}
			<ReviewCardActions
				reviewId={view.reviewId}
				liked={view.viewerHasLiked}
				saved={view.viewerHasSaved}
				shareTitle={view.title}
				likeCount={view.likeCount}
				commentCount={view.commentCount}
				commentsHref={`${view.href}#comments`}
				canLike={view.canLike}
			/>
		{:else}
			<footer
				class="flex items-center justify-between border-t border-line pt-2.5 text-xs text-ink-3"
			>
				<span class="flex items-center gap-1.5">
					<Icon name="calendar" size={14} />
					{view.visitedAt ? formatVisitDate(view.visitedAt) : 'No date'}
				</span>
				{#if view.visibility}
					<span class="flex items-center gap-1.5">
						<Icon name={visibilityIcon[view.visibility]} size={14} />
						{visibilityLabel[view.visibility]}
					</span>
				{/if}
			</footer>
		{/if}
	</div>

	{#if view.href}
		<!-- Stretched link: the whole card opens the review, but the markup stays one anchor
		     rather than wrapping the card (which would swallow the action row's own controls —
		     HTML forbids nesting interactive content, and browsers don't reliably forward
		     keyboard activation through it). The accessible name comes from the title, and
		     everything the anchor must not cover is lifted to z-10. -->
		<a href={view.href} class="absolute inset-0" aria-label={`Open review: ${view.title}`}></a>
	{/if}
</article>
