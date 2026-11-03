<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FilterPill from '#lib/components/FilterPill.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import ExploreCard from '#lib/explore/ExploreCard.svelte';
	import FilterSheet from '#lib/explore/FilterSheet.svelte';
	import PersonRow from '#lib/explore/PersonRow.svelte';
	import PlaceRow from '#lib/explore/PlaceRow.svelte';
	import SearchEmpty from '#lib/explore/SearchEmpty.svelte';
	import {
		activeCount,
		EMPTY_FILTERS,
		type ExploreFilters,
		exploreUrl,
		QUICK_CHIPS,
		quickChipOn,
		removableChips,
		toggleQuickChip
	} from '#lib/explore/explore.ts';
	import { normalizeQuery, searchActive } from '#lib/explore/search.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const search = $derived(data.search);
	// Every link on the page keeps the search and its tab; only the filters or page change.
	const href = (filters: ExploreFilters, cursor: string | null = null) =>
		exploreUrl(filters, { q: search?.q, tab: search?.tab, cursor });

	/* ----------------------------------- search field ----------------------------------- */

	let input = $state<HTMLInputElement>();
	let query = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(timer));

	// A navigation that didn't come from typing (a suggestion, Back, a link) sets the field. While
	// the field has focus it is the source of truth: a slow response must not overwrite newer typing.
	$effect(() => {
		const fromUrl = page.url.searchParams.get('q') ?? '';
		if (document.activeElement !== input) query = fromUrl;
	});

	/** Results are one query per pause in typing, not per keystroke. The tab and filters stay; under
	 *  2 characters the search (and its tab) leaves the URL and the grid comes back. */
	function runSearch() {
		clearTimeout(timer);
		const q = query.trim();
		const url = searchActive(q)
			? exploreUrl(data.filters, { q, tab: search?.tab })
			: exploreUrl(data.filters);
		if (url !== page.url.pathname + page.url.search) {
			void goto(url, { replace: true, reset: false });
		}
	}

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(runSearch, 300);
	}

	function clearSearch() {
		query = '';
		runSearch();
		input?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && query) {
			e.preventDefault();
			clearSearch();
		} else if (e.key === 'Enter') {
			runSearch();
			input?.blur();
		}
	}

	/* -------------------------------------- filters -------------------------------------- */

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

	const clearClass =
		'shrink-0 rounded-lg px-1.5 py-1 text-sm font-semibold whitespace-nowrap text-accent-strong hover:bg-accent-soft';

	/* --------------------------------------- results --------------------------------------- */

	// The query as matched, for highlighting.
	const q = $derived(normalizeQuery(search?.q));
	const tabHref = (tab: string) => exploreUrl(data.filters, { q: search?.q, tab });
	const tabs = $derived(
		search
			? [
					{ value: 'all', label: 'All', href: tabHref('all') },
					{ value: 'food', label: 'Food', href: tabHref('food'), count: search.foodCount },
					{
						value: 'people',
						label: 'People',
						href: tabHref('people'),
						count: search.people.length
					},
					{
						value: 'places',
						label: 'Places',
						href: tabHref('places'),
						count: search.places.length
					}
				]
			: []
	);
	const suggestionHref = (s: string) => exploreUrl(EMPTY_FILTERS, { q: s });

	// The review page's back link returns to this exact view: search, tab, filters and page.
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
	<title>{search ? `“${search.q}” · Explore` : 'Explore'} · Daily Dose of Food</title>
</svelte:head>

{#snippet filterRow()}
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
				href={href(toggleQuickChip(data.filters, chip))}
				label={chip.label}
				selected={quickChipOn(data.filters, chip)}
			/>
		{/each}
		<!-- With only quick chips on there is no removable row to hold it, so it ends this one. -->
		{#if anyFilter && !removable.length}
			<a href={href(EMPTY_FILTERS)} class={clearClass}>Clear all</a>
		{/if}
	</nav>

	{#if removable.length}
		<div
			class="-mx-4 -mt-1 flex scrollbar-none items-center gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:mt-[-8px] lg:flex-wrap lg:overflow-visible lg:px-0"
		>
			{#each removable as chip (chip.label)}
				<FilterPill href={href(chip.without)} label={chip.label} removable />
			{/each}
			<a href={href(EMPTY_FILTERS)} class="{clearClass} text-[13px]">Clear all</a>
		</div>
	{/if}
{/snippet}

{#snippet grid(limit: number = Infinity)}
	<div class="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-5.5">
		{#each cards.slice(0, limit) as card, i (card.review.id)}
			<!-- All shows 4 on a phone and 6 on desktop: the 5th and 6th are desktop-only. -->
			<div class={i >= 4 ? 'max-lg:hidden lg:contents' : 'contents'}>
				<ExploreCard
					review={card.review}
					href={`/review/${card.review.id}?from=${from}`}
					timeAgo={card.timeAgo}
					signedIn={data.signedIn}
				/>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet filteredGrid()}
	{#if cards.length}
		{@render grid()}
		{#if data.nextCursor}
			<!-- A link, as on Home: the next page is a plain navigation that can be linked to. -->
			<a
				href={href(data.filters, data.nextCursor)}
				class="mb-3 self-center rounded-input px-4 py-2 text-center text-sm font-semibold text-accent-strong hover:bg-accent-soft max-lg:mx-auto max-lg:block max-lg:w-fit"
			>
				Show older reviews
			</a>
		{/if}
	{:else if anyFilter}
		<div class="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-sm text-ink-2">
			<Icon name="sort" size={22} />
			<span>No reviews match these filters.</span>
			<a
				href={href(EMPTY_FILTERS)}
				class="inline-flex h-9 items-center rounded-[10px] bg-sunken px-3.5 text-sm font-bold text-ink"
				>Clear filters</a
			>
		</div>
	{:else}
		<p class="p-6 text-center text-[13px] text-ink-3 lg:p-0">No public reviews yet.</p>
	{/if}
{/snippet}

{#snippet section(title: string, more: { tab: string; label: string } | null)}
	<div class="flex min-h-8 items-center justify-between gap-2.5">
		<h3 class="font-display text-lg font-semibold text-ink">{title}</h3>
		{#if more}
			<a
				href={tabHref(more.tab)}
				class="inline-flex items-center gap-1 rounded-lg px-1 py-1.5 text-[13.5px] font-semibold text-accent-strong hover:bg-accent-soft"
				>{more.label}<Icon name="chevR" size={15} weight={2.4} /></a
			>
		{/if}
	</div>
{/snippet}

{#snippet panel(children: Snippet)}
	<div
		class="flex flex-col rounded-card border border-line bg-surface px-3 py-1.5 lg:px-3.5 lg:py-2"
	>
		{@render children()}
	</div>
{/snippet}

<!-- Mobile: a sticky header over the body. Desktop: a 1120px column with a header row.
     Base classes are the phone; `lg:` builds the desktop on top. -->
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
					{search
						? `Results for “${search.q}”`
						: 'What people are eating around Phnom Penh this week.'}
				</p>
			</div>
			<!-- type="text", not "search": the browser's own × would sit next to ours. -->
			<div
				class="flex h-12 items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] lg:w-[300px]"
			>
				<Icon name="search" size={18} class="text-ink-3" />
				<input
					bind:this={input}
					bind:value={query}
					{oninput}
					{onkeydown}
					type="text"
					aria-label="Search dishes, places and people"
					placeholder="Search dishes, places, people"
					autocomplete="off"
					enterkeyhint="search"
					class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
				/>
				{#if query}
					<button
						type="button"
						onclick={clearSearch}
						aria-label="Clear search"
						class="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 hover:text-ink"
					>
						<Icon name="x" size={14} weight={2.4} />
					</button>
				{/if}
			</div>
		</div>

		{#if search}
			<!-- On a phone the tabs take the filter row's place in the header. -->
			<div class="-mx-4 -mb-3 lg:mx-0 lg:-mt-1.5 lg:mb-0">
				<Tabs options={tabs} current={search.tab} ariaLabel="Search results" plainCounts />
			</div>
		{:else}
			{@render filterRow()}
		{/if}
	</div>

	<div class="flex flex-col gap-4.5 px-3 py-3 lg:p-0 {search ? 'max-lg:px-4 max-lg:pt-3.5' : ''}">
		{#if !search}
			{@render filteredGrid()}
		{:else if search.tab === 'food'}
			{#if search.foodCount}
				<div class="flex flex-col gap-3 lg:gap-4.5">{@render filterRow()}</div>
				{@render filteredGrid()}
			{:else}
				<SearchEmpty what="dishes or drinks" query={search.q} hrefFor={suggestionHref} />
			{/if}
		{:else if search.tab === 'people'}
			{#if search.people.length}
				{#snippet people()}
					{#each search.people as person (person.id)}
						<PersonRow {person} {q} signedIn={data.signedIn} />
					{/each}
				{/snippet}
				{@render panel(people)}
			{:else}
				<SearchEmpty what="people" query={search.q} hrefFor={suggestionHref} />
			{/if}
		{:else if search.tab === 'places'}
			{#if search.places.length}
				{#snippet placeList()}
					{#each search.places as place (place.id)}
						<PlaceRow {place} {q} query={search.q} />
					{/each}
				{/snippet}
				{@render panel(placeList)}
			{:else}
				<SearchEmpty what="places" query={search.q} hrefFor={suggestionHref} />
			{/if}
		{:else if !search.foodCount && !search.people.length && !search.places.length}
			<SearchEmpty what="results" query={search.q} hrefFor={suggestionHref} />
		{:else}
			<!-- All: the top few of each, People and Places side by side on desktop, then Food. -->
			{#if search.people.length || search.places.length}
				<div class="grid gap-4.5 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
					{#if search.people.length}
						<section class="flex flex-col gap-1.5">
							{@render section(
								'People',
								search.people.length > 3
									? { tab: 'people', label: `See all ${search.people.length}` }
									: null
							)}
							{#snippet topPeople()}
								{#each search.people.slice(0, 3) as person (person.id)}
									<PersonRow {person} {q} signedIn={data.signedIn} />
								{/each}
							{/snippet}
							{@render panel(topPeople)}
						</section>
					{/if}
					{#if search.places.length}
						<section class="flex flex-col gap-1.5">
							{@render section(
								'Places',
								search.places.length > 3
									? { tab: 'places', label: `See all ${search.places.length}` }
									: null
							)}
							{#snippet topPlaces()}
								{#each search.places.slice(0, 3) as place (place.id)}
									<PlaceRow {place} {q} query={search.q} />
								{/each}
							{/snippet}
							{@render panel(topPlaces)}
						</section>
					{/if}
				</div>
			{/if}
			{#if search.foodCount}
				<section class="flex flex-col gap-1.5">
					<!-- "See all" only when there's more than this screen shows: 4 on a phone, 6 on desktop. -->
					<div class="flex min-h-8 items-center justify-between gap-2.5">
						<h3 class="font-display text-lg font-semibold text-ink">Food</h3>
						<a
							href={tabHref('food')}
							class="items-center gap-1 rounded-lg px-1 py-1.5 text-[13.5px] font-semibold text-accent-strong hover:bg-accent-soft {search.foodCount >
							4
								? 'inline-flex'
								: 'hidden'} {search.foodCount > 6 ? 'lg:inline-flex' : 'lg:hidden'}"
							>See all {search.foodCount}<Icon name="chevR" size={15} weight={2.4} /></a
						>
					</div>
					{@render grid(6)}
				</section>
			{/if}
		{/if}
	</div>
</main>

<FilterSheet
	open={filtersOpen}
	filters={data.filters}
	facets={data.facets}
	matchCount={data.matchCount}
	query={search?.q ?? ''}
	hrefFor={(filters) => href(filters)}
	onclose={() => (filtersOpen = false)}
/>
