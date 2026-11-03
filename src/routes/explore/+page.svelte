<script lang="ts">
	import { page } from '$app/state';
	import FilterPill from '#lib/components/FilterPill.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ExploreCard from '#lib/explore/ExploreCard.svelte';
	import FilterSheet from '#lib/explore/FilterSheet.svelte';
	import {
		activeCount,
		EMPTY_FILTERS,
		exploreUrl,
		QUICK_CHIPS,
		quickChipOn,
		removableChips,
		toggleQuickChip
	} from '#lib/explore/explore.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let filtersOpen = $state(false);
	const filterCount = $derived(activeCount(data.filters));

	// Filters set in the panel that no quick chip shows, named from the panel's facet lists.
	const removable = $derived.by(() => {
		const names = new Map(
			[...data.facets.cuisines, ...data.facets.kinds].map((f) => [f.slug, f.name])
		);
		return removableChips(data.filters, (slug) => names.get(slug) ?? slug);
	});
	// Clearing drops the sort too: it is one of the removable chips "Clear all" stands for.
	const anyFilter = $derived(filterCount > 0 || data.filters.sort !== 'new');
	const clearHref = exploreUrl(EMPTY_FILTERS);

	// The review page's back link returns to this exact grid: filter and page.
	const from = $derived(encodeURIComponent(page.url.pathname + page.url.search));

	const clearClass =
		'shrink-0 rounded-lg px-1.5 py-1 text-sm font-semibold whitespace-nowrap text-accent-strong hover:bg-accent-soft';

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
			<button
				type="button"
				aria-haspopup="dialog"
				onclick={() => (filtersOpen = true)}
				class="inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-[13px] whitespace-nowrap transition-colors hover:border-ink-3 {filterCount
					? 'border-ink-3 font-semibold text-ink'
					: 'border-line font-medium text-ink-2'}"
			>
				<Icon name="sort" size={14} />Filters
				{#if filterCount}
					<span
						class="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent"
						>{filterCount}</span
					>
				{/if}
			</button>
			<span class="mx-0.5 my-1 w-px shrink-0 self-stretch bg-line" aria-hidden="true"></span>
			{#each QUICK_CHIPS as chip (chip.label)}
				<FilterPill
					href={exploreUrl(toggleQuickChip(data.filters, chip))}
					label={chip.label}
					selected={quickChipOn(data.filters, chip)}
				/>
			{/each}
			<!-- With only quick chips on there is no removable row to hold it, so it ends this one. -->
			{#if anyFilter && !removable.length}
				<a href={clearHref} class={clearClass}>Clear all</a>
			{/if}
		</nav>

		{#if removable.length}
			<div
				class="-mx-4 -mt-1 flex scrollbar-none items-center gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:mt-[-8px] lg:flex-wrap lg:overflow-visible lg:px-0"
			>
				{#each removable as chip (chip.label)}
					<FilterPill href={exploreUrl(chip.without)} label={chip.label} removable />
				{/each}
				<a href={clearHref} class="{clearClass} text-[13px]">Clear all</a>
			</div>
		{/if}
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
				href={exploreUrl(data.filters, { cursor: data.nextCursor })}
				class="mb-3 self-center rounded-input px-4 py-2 text-center text-sm font-semibold text-accent-strong hover:bg-accent-soft max-lg:mx-auto max-lg:block max-lg:w-fit"
			>
				Show older reviews
			</a>
		{/if}
	{:else if anyFilter}
		<div
			class="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-sm text-ink-2 lg:py-9"
		>
			<Icon name="sort" size={22} />
			<span>No reviews match these filters.</span>
			<a
				href={clearHref}
				class="inline-flex h-9 items-center rounded-[10px] bg-sunken px-3.5 text-sm font-bold text-ink"
				>Clear filters</a
			>
		</div>
	{:else}
		<p class="p-6 text-center text-[13px] text-ink-3 lg:p-0">No public reviews yet.</p>
	{/if}
</main>

<FilterSheet
	open={filtersOpen}
	filters={data.filters}
	facets={data.facets}
	matchCount={data.matchCount}
	hrefFor={(filters) => exploreUrl(filters)}
	onclose={() => (filtersOpen = false)}
/>
