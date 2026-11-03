<script lang="ts">
	/** A place opened from Explore search: a header card (name, address, rating, reviews, price
	 *  range, what people mostly order), then every review there with "What people order" chips.
	 *  The filters and sort are local state over reviews already loaded, so the grid updates the
	 *  moment a chip is tapped; there's no Explore title or search field here (a field invites
	 *  typing and would repeat the query), only a back link carrying it. */
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import ExploreCard from '#lib/explore/ExploreCard.svelte';
	import { SORTS } from '#lib/explore/explore.ts';
	import {
		capDishes,
		dishChips,
		filterPlaceReviews,
		PLACE_FILTERS,
		type PlaceFilters,
		placeSummary,
		placeToggles,
		toPlaceReview
	} from '#lib/explore/place.ts';
	import { searchActive } from '#lib/explore/search.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Opening another place starts over: both reset whenever the place id changes (the page
	// component is reused across /places/a → /places/b). Writable, so the chips can set them.
	let filters = $derived.by<PlaceFilters>(() => (data.place.id, { ...PLACE_FILTERS }));
	let moreDishes = $derived.by(() => (data.place.id, false));
	const set = (patch: Partial<PlaceFilters>) => (filters = { ...filters, ...patch });

	const list = $derived(data.reviews.map(toPlaceReview));
	const summary = $derived(placeSummary(list));
	const dishes = $derived(dishChips(list));
	const toggles = $derived(placeToggles(list));
	const cap = $derived(capDishes(dishes, filters.dish, moreDishes));
	const capHidden = $derived(
		new Set(dishes.filter((d) => !cap.shown.includes(d)).map((d) => d.key))
	);
	const showRow = $derived(dishes.length > 1 || toggles.following || toggles.photos);

	const byId = $derived(new Map(data.reviews.map((r) => [r.id, r])));
	const cards = $derived.by(() => {
		const now = new Date();
		return filterPlaceReviews(list, filters).map((r) => {
			const review = byId.get(r.id)!;
			return { review, timeAgo: timeAgo(review.publishedAt ?? review.visitedAt, now) };
		});
	});

	const fromSearch = $derived(searchActive(data.query));
	const backHref = $derived(
		fromSearch ? `/explore?q=${encodeURIComponent(data.query)}` : '/explore'
	);
	const directions = $derived(
		data.place.lat !== null && data.place.lng !== null
			? `https://www.google.com/maps/search/?api=1&query=${data.place.lat},${data.place.lng}`
			: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
					[data.place.name, data.place.address].filter(Boolean).join(', ')
				)}`
	);
	// The review page's back link returns here.
	const from = $derived(encodeURIComponent(page.url.pathname + page.url.search));

	const chip =
		'inline-flex h-7.5 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[13px] whitespace-nowrap transition-colors';
	const chipOn = 'border-ink bg-ink font-semibold text-bg';
	const chipOff = 'border-line bg-surface font-medium text-ink-2 hover:border-ink-3';
	const button =
		'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-sm font-bold';
</script>

<svelte:head>
	<title>{data.place.name} · Daily Dose of Food</title>
</svelte:head>

<main
	class="flex flex-col gap-3.5 px-4 pt-3.5 pb-6 lg:mx-auto lg:max-w-[1120px] lg:gap-4.5 lg:px-8 lg:pt-7.5 lg:pb-12"
>
	<a
		href={backHref}
		class="-mb-1 -ml-1.5 inline-flex items-center gap-1 self-start rounded-lg px-1.5 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft lg:mb-0"
	>
		<Icon name="chevL" size={16} weight={2.2} />
		{fromSearch ? `Back to results for “${data.query}”` : 'Back to Explore'}
	</a>

	<section
		aria-label={data.place.name}
		class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3.5 lg:flex-nowrap lg:gap-4 lg:rounded-[18px] lg:px-5 lg:py-4.5"
	>
		<span
			class="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-accent-soft text-accent-strong lg:size-14"
		>
			<Icon name="pin" size={24} />
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-[3px]">
			<h1 class="font-display text-xl leading-tight font-semibold text-ink lg:text-2xl">
				{data.place.name}
			</h1>
			{#if data.place.address}
				<span class="text-[13.5px] text-ink-3">{data.place.address}</span>
			{/if}
			<div class="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13.5px] text-ink-2">
				{#if summary.count}
					<span class="inline-flex items-center gap-1">
						<svg
							viewBox="0 0 24 24"
							fill="currentColor"
							class="size-3.5 text-accent"
							aria-hidden="true"
						>
							<path d={STAR_PATH} />
						</svg>
						<b class="font-semibold text-ink">{summary.average.toFixed(1)}</b>
					</span>
					<span>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</span>
					{#if summary.priceRange}<span>{summary.priceRange}</span>{/if}
					{#if summary.mostly}<span>Mostly {summary.mostly}</span>{/if}
				{:else}
					<span>No reviews yet</span>
				{/if}
			</div>
		</div>
		<div class="flex w-full shrink-0 gap-2 lg:w-auto">
			<a
				href={directions}
				target="_blank"
				rel="noopener noreferrer"
				class="{button} flex-1 border border-line-2 bg-surface text-ink hover:bg-sunken lg:flex-none"
			>
				<Icon name="nav" size={15} />Directions
			</a>
			<a href="/review/new" class="{button} flex-1 bg-sunken text-ink lg:flex-none">
				<Icon name="pencil" size={15} />Review it
			</a>
		</div>
	</section>

	{#if summary.count}
		<div class="flex flex-wrap items-center justify-between gap-2.5">
			<h2 class="font-display text-lg font-semibold text-ink">Reviews here</h2>
			{#if summary.count > 1}
				<div class="flex gap-1.5" role="group" aria-label="Sort reviews">
					{#each SORTS as s (s.value)}
						<button
							type="button"
							aria-pressed={filters.sort === s.value}
							onclick={() => set({ sort: s.value })}
							class="{chip} h-7 text-[12.5px] {filters.sort === s.value ? chipOn : chipOff}"
							>{s.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		{#if showRow}
			<div class="-mt-1.5 flex flex-col gap-2">
				<span class="text-xs font-bold tracking-[.06em] text-ink-3 uppercase"
					>What people order</span
				>
				<!-- Phone: one row that swipes sideways under a fade, bleeding to the screen edges.
				     Desktop: you can't swipe with a mouse, so it wraps and caps the dishes at 8. The
				     toggles come first so they never scroll out of sight. -->
				<div
					class="dish-row -mx-4 flex scrollbar-none gap-1.5 overflow-x-auto overscroll-x-contain px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
				>
					{#if toggles.following}
						<button
							type="button"
							aria-pressed={filters.following}
							onclick={() => set({ following: !filters.following })}
							class="{chip} {filters.following ? chipOn : chipOff}"
						>
							<Icon name="users" size={13} weight={2.2} />People I follow
						</button>
					{/if}
					{#if toggles.photos}
						<button
							type="button"
							aria-pressed={filters.photos}
							onclick={() => set({ photos: !filters.photos })}
							class="{chip} {filters.photos ? chipOn : chipOff}"
						>
							<Icon name="camera" size={13} weight={2.2} />Has photos
						</button>
					{/if}
					{#if (toggles.following || toggles.photos) && dishes.length > 1}
						<span class="mx-0.5 my-1 w-px shrink-0 self-stretch bg-line" aria-hidden="true"></span>
					{/if}
					{#if dishes.length > 1}
						{#each dishes as dish (dish.key)}
							{@const on = filters.dish === dish.key}
							<button
								type="button"
								aria-pressed={on}
								onclick={() => set({ dish: on ? null : dish.key })}
								class="{chip} {on ? chipOn : chipOff} {capHidden.has(dish.key) ? 'lg:hidden' : ''}"
							>
								{dish.label}<span
									class="ml-1 text-xs font-semibold {on ? 'opacity-70' : 'text-ink-3'}"
									>{dish.count}</span
								>
							</button>
						{/each}
						{#if cap.capped || moreDishes}
							<button
								type="button"
								onclick={() => (moreDishes = !moreDishes)}
								class="{chip} border-dashed border-line bg-surface font-semibold text-ink-2 hover:border-ink-3 max-lg:hidden"
							>
								{moreDishes ? 'Show less' : `+${cap.hidden} more`}
							</button>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		{#if cards.length}
			<div class="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-5.5">
				{#each cards as card (card.review.id)}
					<ExploreCard
						review={card.review}
						href={`/review/${card.review.id}?from=${from}`}
						timeAgo={card.timeAgo}
						signedIn={data.signedIn}
					/>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-sm text-ink-2">
				<Icon name="sort" size={22} />
				<span>None of the reviews here match.</span>
				<!-- Clears the place filters, not the sort. -->
				<button
					type="button"
					onclick={() => set({ dish: null, following: false, photos: false })}
					class="{button} bg-sunken text-ink">Show all reviews</button
				>
			</div>
		{/if}
	{/if}
</main>

<style>
	/* The "there's more" hint on a phone: the row fades out over its last 28px. */
	@media (max-width: 63.99rem) {
		.dish-row {
			mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
		}
	}
</style>
