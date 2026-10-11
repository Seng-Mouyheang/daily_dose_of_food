<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import FactsGrid from '#lib/review/FactsGrid.svelte';
	import LocationPanel from '#lib/review/LocationPanel.svelte';
	import PhotoCarousel from '#lib/review/PhotoCarousel.svelte';
	import RatingPanel from '#lib/review/RatingPanel.svelte';
	import ReviewCardActions from '#lib/review/ReviewCardActions.svelte';
	import TagGroups from '#lib/review/TagGroups.svelte';
	import { primaryItem, reviewTitle, totalWithTax } from '#lib/review/card.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const review = $derived(data.review);
	const title = $derived(reviewTitle(review));
	const item = $derived(primaryItem(review.items));
	const total = $derived(totalWithTax(review.items));
	const published = $derived(timeAgo(review.publishedAt ?? review.visitedAt));

	const price = $derived(
		review.items.reduce<number | null>(
			(sum, i) => (i.price === null ? sum : (sum ?? 0) + i.price),
			null
		)
	);

	// A "both" review has two items that can carry different rates; one shared rate is shown as a
	// percentage, differing rates fall back to plain "incl. tax" rather than picking one.
	const taxLabel = $derived.by(() => {
		const rates = new Set(
			review.items.filter((i) => i.price !== null).map((i) => i.taxPercent ?? 0)
		);
		const [rate] = rates;
		return rates.size === 1 && rate ? `incl. ${rate}% tax` : 'incl. tax';
	});

	/** "French · Dessert · $7.02 total incl. 8% tax" — whichever of those three the review has. */
	const subtitle = $derived(
		[
			item?.cuisineLabel,
			item?.typeLabel,
			total === null ? null : `$${total.toFixed(2)} total ${taxLabel}`
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<svelte:head>
	<title>{title} — Daily Dose of Food</title>
</svelte:head>

<div class="mx-auto max-w-[1120px] px-4 pt-3 pb-4 lg:px-8 lg:pb-6">
	<a
		href="/"
		class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-strong"
	>
		<Icon name="chevL" size={16} weight={2.2} />
		Back to feed
	</a>

	<!-- One column on mobile, in the handoff's order. On desktop the gallery and location move
	     into a left column that stays put while the write-up on the right scrolls. -->
	<div class="mt-2 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
		{#if review.photos.length}
			<div class="flex flex-col gap-5 lg:sticky lg:top-6">
				<PhotoCarousel photos={review.photos} {title} showThumbnails />
				<div class="hidden lg:block">
					<LocationPanel place={review.place} visitType={review.visitType} />
				</div>
			</div>
		{/if}

		<div class="flex min-w-0 flex-col gap-5">
			<div class="flex items-center gap-3">
				<Avatar src={review.author.avatarUrl} name={review.author.displayName} size={40} />
				<div class="min-w-0 flex-1">
					<p class="font-bold text-ink">{review.author.displayName}</p>
					<p class="text-[13px] text-ink-2">
						{data.isOwnReview ? 'Your review' : 'Reviewer'} · {published}
					</p>
				</div>
				{#if data.isOwnReview}
					<!-- Editing a published review isn't built yet — the wizard only creates. Shown
					     disabled rather than hidden so the author can see it is coming. -->
					<Button variant="ghost" disabled class="h-9 gap-1.5 px-3 text-sm">
						<Icon name="pencil" size={15} />
						Edit
					</Button>
				{:else}
					<Button variant="ghost" disabled class="h-9 px-3 text-sm">Follow</Button>
				{/if}
			</div>

			<div>
				<div class="flex items-baseline justify-between gap-3">
					<h1
						class="font-display text-[26px] leading-tight font-semibold tracking-tight text-balance text-ink"
					>
						{title}
					</h1>
					{#if price !== null}
						<span class="shrink-0 font-display text-[22px] font-semibold text-ink tabular-nums">
							${price.toFixed(2)}
						</span>
					{/if}
				</div>
				{#if subtitle}
					<p class="mt-1 text-sm text-ink-2">{subtitle}</p>
				{/if}
				{#if review.isFavorite}
					<p
						class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fav-soft px-2.5 py-1 text-xs font-bold text-fav"
					>
						<Icon name="heart" size={13} />
						One of their favorites
					</p>
				{/if}
			</div>

			<RatingPanel overallRating={review.overallRating} categoryRatings={review.categoryRatings} />

			<TagGroups tags={review.tags} />

			{#if review.description}
				<!-- Set in the display serif, larger and looser than body copy: this is the part
				     someone came to read, and the rest of the page is data about it. -->
				<p
					class="max-w-[62ch] font-display text-[16.5px] leading-relaxed whitespace-pre-line text-ink"
				>
					{review.description}
				</p>
			{/if}

			<FactsGrid {review} />

			{#if !review.photos.length}
				<!-- With no gallery there is no left column, so location comes inline here. -->
				<LocationPanel place={review.place} visitType={review.visitType} />
			{:else}
				<div class="lg:hidden">
					<LocationPanel place={review.place} visitType={review.visitType} />
				</div>
			{/if}

			<div class="px-2.5">
				<ReviewCardActions />
			</div>

			<section id="comments" class="flex scroll-mt-6 flex-col gap-3">
				<h2 class="font-display text-lg font-semibold text-ink">Comments</h2>
				<!-- Honest empty state, not a disabled composer: there is no review_comments table,
				     so a text box here would take input it could never save. -->
				<div class="rounded-card border border-line bg-surface p-5">
					<p class="text-sm text-ink-2">
						Comments aren't available yet. When they are, this is where they'll be.
					</p>
				</div>
			</section>
		</div>
	</div>
</div>
