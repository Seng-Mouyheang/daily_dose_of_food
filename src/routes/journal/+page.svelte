<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import JournalRow from '#lib/journal/JournalRow.svelte';
	import { JOURNAL_FILTERS, journalHref } from '#lib/journal/query.ts';
	import FactsGrid from '#lib/review/FactsGrid.svelte';
	import PhotoCarousel from '#lib/review/PhotoCarousel.svelte';
	import RatingPanel from '#lib/review/RatingPanel.svelte';
	import TagGroups from '#lib/review/TagGroups.svelte';
	import { primaryItem, reviewTitle, totalBeforeTax } from '#lib/review/card.ts';
	import { formatVisitDate } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const query = $derived(data.query);
	const items = $derived(data.items);
	const isBookmarks = $derived(query.tab === 'bookmarks');

	const tabs = $derived([
		{
			value: 'reviews',
			label: 'My reviews',
			href: journalHref(query, { tab: 'reviews' }),
			count: data.counts.mine
		},
		{
			value: 'bookmarks',
			label: 'Bookmarks',
			href: journalHref(query, { tab: 'bookmarks' }),
			count: data.counts.saved
		}
	]);

	// Search applies as you type, debounced, through the URL, so the server does the matching
	// and the result can be reloaded or shared. The <form> around it still submits a plain GET
	// without JavaScript.
	let searchText = $derived(query.q);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			goto(journalHref(query, { q: searchText.trim(), selected: null }), {
				replace: true,
				reset: false
			});
		}, 250);
	}

	/* ------------------------------ desktop preview pane ------------------------------ */

	const selected = $derived(items.find((r) => r.id === query.selected) ?? items[0] ?? null);

	/** Desktop only: a row click selects it for the preview pane instead of leaving the page.
	 *  On a phone the row is an ordinary link to the review. */
	function selectRow(id: string): boolean {
		if (!window.matchMedia('(min-width: 1024px)').matches) return false;
		goto(journalHref(query, { selected: id }), { replace: true, reset: false });
		return true;
	}

	const filtered = $derived(query.q !== '' || query.filter !== 'all');
</script>

<svelte:head>
	<title>My journal — Daily Dose of Food</title>
</svelte:head>

{#snippet tools()}
	<div class="flex flex-col gap-2.5 px-4 pt-3 pb-2.5 lg:px-5">
		{#if query.archived}
			<a
				href={journalHref(query, { archived: false })}
				class="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-accent-strong"
			>
				<Icon name="chevL" size={16} weight={2.2} />
				Back to my reviews
			</a>
		{/if}
		<form method="GET" action="/journal" class="flex items-center gap-2" role="search">
			{#if isBookmarks}<input type="hidden" name="tab" value="bookmarks" />{/if}
			{#if query.archived}<input type="hidden" name="archived" value="1" />{/if}
			{#if query.sort !== 'newest'}<input type="hidden" name="sort" value={query.sort} />{/if}
			{#if query.filter !== 'all'}<input type="hidden" name="filter" value={query.filter} />{/if}
			<label
				class="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 text-ink-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft"
			>
				<Icon name="search" size={18} />
				<span class="sr-only">Search</span>
				<input
					type="search"
					name="q"
					bind:value={searchText}
					oninput={onSearchInput}
					placeholder={isBookmarks ? 'Search dishes, places, people' : 'Search dishes and places'}
					autocomplete="off"
					class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
				/>
			</label>
			<a
				href={journalHref(query, { sort: query.sort === 'top' ? 'newest' : 'top' })}
				class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-input bg-sunken px-3.5 text-sm font-semibold text-ink"
				aria-label={`Sort: ${query.sort === 'top' ? 'Top rated' : 'Newest'}. Change sort.`}
			>
				<Icon name="sort" size={16} />
				{query.sort === 'top' ? 'Top rated' : 'Newest'}
			</a>
		</form>
		<nav aria-label="Filter" class="flex flex-wrap gap-1.5">
			{#each JOURNAL_FILTERS as f (f.value)}
				{@const on = query.filter === f.value}
				<a
					href={journalHref(query, { filter: f.value })}
					aria-current={on ? 'true' : undefined}
					class="inline-flex h-[30px] items-center rounded-full border px-3 text-sm font-medium transition-colors {on
						? 'border-transparent bg-accent-soft text-accent-strong'
						: 'border-line bg-surface text-ink-2 hover:border-ink-3'}">{f.label}</a
				>
			{/each}
		</nav>
	</div>
{/snippet}

{#snippet empty()}
	<div class="flex flex-col items-center gap-2 px-7 py-11 text-center">
		<span
			class="mb-1 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-strong"
		>
			<Icon
				name={filtered ? 'search' : isBookmarks ? 'bookmark' : query.archived ? 'archive' : 'plate'}
				size={24}
			/>
		</span>
		{#if filtered}
			<b class="font-display text-lg font-semibold text-ink">No matches</b>
			<p class="max-w-[34ch] text-sm text-ink-2">Try another search or filter.</p>
			<a
				href={journalHref(query, { q: '', filter: 'all' })}
				class="mt-1.5 inline-flex h-9 items-center rounded-input bg-sunken px-3.5 text-sm font-semibold text-ink"
				>Clear filters</a
			>
		{:else if isBookmarks}
			<b class="font-display text-lg font-semibold text-ink">Nothing saved yet</b>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Tap the bookmark on any review to keep it here for your next meal out.
			</p>
			<a
				href="/"
				class="mt-1.5 inline-flex h-9 items-center rounded-input bg-sunken px-3.5 text-sm font-semibold text-ink"
				>Explore reviews</a
			>
		{:else if query.archived}
			<b class="font-display text-lg font-semibold text-ink">No archived reviews</b>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Reviews you archive are hidden from your profile and feed, and kept here.
			</p>
		{:else}
			<b class="font-display text-lg font-semibold text-ink">Your journal is empty</b>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Write your first review and it will show up here.
			</p>
			<Button href="/review/new" class="mt-1.5 h-9 px-3.5 text-sm">Write a review</Button>
		{/if}
	</div>
{/snippet}

{#snippet list()}
	{#if items.length}
		<ul class="border-y border-line">
			{#each items as review (review.id)}
				<li class="border-line [&+&]:border-t">
					<JournalRow
						{review}
						showAuthor={isBookmarks}
						selected={selected?.id === review.id}
						onselect={selectRow}
					/>
				</li>
			{/each}
		</ul>
		{#if data.nextCursor}
			<a
				href={journalHref(query, { cursor: data.nextCursor })}
				class="mx-auto my-3 block w-fit rounded-input px-4 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
			>
				Show more
			</a>
		{/if}
	{:else}
		{@render empty()}
	{/if}

	{#if !isBookmarks && !query.archived && data.counts.archived > 0}
		<a
			href={journalHref(query, { archived: true, q: '', filter: 'all', selected: null })}
			class="flex min-h-11 w-full items-center gap-2 border-b border-line p-4 text-sm font-semibold text-ink-2 hover:text-ink lg:px-5"
		>
			<Icon name="archive" size={16} />
			Archived reviews
			<span class="ml-auto rounded-full bg-sunken px-2 py-px text-xs">{data.counts.archived}</span>
			<Icon name="chevR" size={16} />
		</a>
	{/if}
{/snippet}

<div class="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[440px_minmax(0,1fr)]">
	<section class="flex min-h-0 flex-col bg-bg lg:border-r lg:border-line" aria-label="Journal list">
		<div class="px-4 pt-5 pb-3 lg:px-5 lg:pt-6">
			<h1 class="font-display text-[26px] font-semibold text-ink lg:text-[28px]">My journal</h1>
			<p class="mt-0.5 text-sm text-ink-2">
				{data.counts.mine}
				{data.counts.mine === 1 ? 'review' : 'reviews'} · {data.counts.saved} bookmarked
			</p>
		</div>
		<div class="bg-surface lg:bg-transparent lg:px-5">
			<Tabs options={tabs} current={query.tab} ariaLabel="Journal" />
		</div>
		<div class="min-h-0 flex-1 lg:overflow-y-auto">
			{@render tools()}
			{@render list()}
		</div>
	</section>

	<!-- Desktop only: a read-only preview of the selected row, built from the list data already
	     loaded, so selecting a row costs no request. -->
	<section class="hidden min-h-0 overflow-y-auto bg-surface lg:block" aria-label="Preview">
		{#if selected}
			{@const title = reviewTitle(selected)}
			{@const item = primaryItem(selected.items)}
			{@const price = totalBeforeTax(selected.items)}
			<div class="mx-auto flex max-w-[640px] flex-col gap-5 px-9 pt-7 pb-12">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<span class="text-[13px] font-semibold tracking-wide text-accent-strong">
						{isBookmarks
							? `Saved from ${selected.author.displayName}`
							: `Your review · ${formatVisitDate(selected.visitedAt.slice(0, 10))}`}
					</span>
					<Button href={`/review/${selected.id}`} class="h-9 gap-1.5 px-3.5 text-sm">
						Open full review
						<Icon name="chevR" size={16} weight={2.4} />
					</Button>
				</div>

				{#if selected.photos.length}
					<!-- Keyed so switching rows starts the gallery back at the cover. -->
					{#key selected.id}
						<PhotoCarousel photos={selected.photos} {title} />
					{/key}
				{/if}

				<div>
					<div class="flex items-baseline justify-between gap-3">
						<h2
							class="font-display text-[26px] leading-tight font-semibold tracking-tight text-balance text-ink"
						>
							{title}
						</h2>
						{#if price !== null}
							<span class="shrink-0 font-display text-[22px] font-semibold text-ink tabular-nums">
								${price.toFixed(2)}
							</span>
						{/if}
					</div>
					<p class="mt-1 text-sm text-ink-2">
						{[selected.place.name, item?.cuisineLabel, item?.typeLabel].filter(Boolean).join(' · ')}
					</p>
				</div>

				<RatingPanel
					overallRating={selected.overallRating}
					categoryRatings={selected.categoryRatings}
				/>
				<TagGroups tags={selected.tags} />
				{#if selected.description}
					<p
						class="max-w-[62ch] font-display text-[16.5px] leading-relaxed whitespace-pre-line text-ink"
					>
						{selected.description}
					</p>
				{/if}
				<FactsGrid review={selected} />
			</div>
		{:else}
			<div class="mt-20 flex flex-col items-center gap-2 px-7 text-center">
				<span
					class="mb-1 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-strong"
				>
					<Icon name="book" size={24} />
				</span>
				<b class="font-display text-lg font-semibold text-ink">Nothing to preview</b>
				<p class="max-w-[34ch] text-sm text-ink-2">Pick a review on the left to see it here.</p>
			</div>
		{/if}
	</section>
</div>
