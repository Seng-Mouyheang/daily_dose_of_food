<script lang="ts">
	import { page } from '$app/state';
	import FilterPill from '#lib/components/FilterPill.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ExploreCard from '#lib/explore/ExploreCard.svelte';
	import { EXPLORE_FILTERS, exploreHref } from '#lib/explore/explore.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const filterLabel = $derived(EXPLORE_FILTERS.find((f) => f.value === data.filter)?.label);

	// The review page's back link returns to this exact grid: filter and page.
	const from = $derived(encodeURIComponent(page.url.pathname + page.url.search));

	// One `now` per render, as on Home, so the grid can't disagree about what "2h ago" means.
	const cards = $derived.by(() => {
		const now = new Date();
		return data.reviews.map((review) => ({
			review,
			timeAgo: timeAgo(review.publishedAt ?? review.visitedAt, now)
		}));
	});
</script>

<svelte:head>
	<title>Explore · Daily Dose of Food</title>
</svelte:head>

<!-- Mobile: a sticky header over a 2-column grid. Desktop: a 1120px column, header row, wrapping
     chips and a 3-column grid. Base classes are the phone; `lg:` builds the desktop on top. -->
<main
	class="lg:mx-auto lg:flex lg:max-w-[1120px] lg:flex-col lg:gap-4.5 lg:px-8 lg:pt-7.5 lg:pb-12"
>
	<div
		class="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-surface px-4 pt-2 pb-3 lg:static lg:gap-4.5 lg:border-0 lg:bg-transparent lg:p-0"
	>
		<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
			<div>
				<h1
					class="font-display text-[26px] font-semibold text-ink lg:text-[28px] lg:tracking-tight"
				>
					Explore
				</h1>
				<p class="mt-1 hidden text-[14.5px] text-ink-2 lg:block">
					What people are eating around Phnom Penh this week.
				</p>
			</div>
			<!-- Search has no results design yet (spec §7), so the field is here but does nothing. -->
			<label
				class="flex h-12 items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 focus-within:border-accent lg:w-[300px]"
			>
				<Icon name="search" size={18} class="text-ink-3" />
				<input
					type="search"
					aria-label="Search"
					placeholder="Search dishes, places, people"
					autocomplete="off"
					class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
				/>
			</label>
		</div>

		<!-- One row that scrolls sideways on a phone, bleeding to the screen edges; wraps on desktop. -->
		<nav
			aria-label="Filter"
			class="-mx-4 flex scrollbar-none gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
		>
			{#each EXPLORE_FILTERS as f (f.value)}
				<FilterPill
					href={exploreHref(f.value)}
					label={f.label}
					selected={data.filter === f.value}
				/>
			{/each}
		</nav>
	</div>

	{#if cards.length}
		<div class="grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-3 lg:gap-5.5 lg:p-0">
			{#each cards as card (card.review.id)}
				<ExploreCard
					review={card.review}
					href={`/review/${card.review.id}?from=${from}`}
					timeAgo={card.timeAgo}
					signedIn={data.signedIn}
				/>
			{/each}
		</div>

		{#if data.nextCursor}
			<!-- A link, as on Home: the next page is a plain navigation that can be linked to. -->
			<a
				href={exploreHref(data.filter, data.nextCursor)}
				class="mb-3 self-center rounded-input px-4 py-2 text-center text-sm font-semibold text-accent-strong hover:bg-accent-soft max-lg:mx-auto max-lg:block max-lg:w-fit"
			>
				Show older reviews
			</a>
		{/if}
	{:else}
		<p class="p-6 text-center text-[13px] text-ink-3 lg:p-0">
			{data.filter === 'all' ? 'No public reviews yet.' : `No reviews match “${filterLabel}” yet.`}
		</p>
	{/if}
</main>
