<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import ActionSheet, { type SheetAction } from '#lib/components/ActionSheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import Icon from '#lib/components/Icon.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import JournalRow from '#lib/journal/JournalRow.svelte';
	import {
		JOURNAL_ACTIONS,
		runJournalAction,
		undoJournalAction,
		type JournalActionKind
	} from '#lib/journal/actions.ts';
	import { JOURNAL_FILTERS, JOURNAL_SORTS, journalHref } from '#lib/journal/query.ts';
	import FactsGrid from '#lib/review/FactsGrid.svelte';
	import PhotoCarousel from '#lib/review/PhotoCarousel.svelte';
	import RatingPanel from '#lib/review/RatingPanel.svelte';
	import TagGroups from '#lib/review/TagGroups.svelte';
	import {
		primaryItem,
		reviewTitle,
		totalBeforeTax,
		totalWithTax,
		type FeedReview
	} from '#lib/review/card.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/* Tab switching is instant: the load also returns the other tab's first page, so a tab
	   click shows that at once, then a real navigation updates the URL and the data behind it.
	   `shownTab` resets itself on every load, when the server's tab is the truth again. */
	let shownTab = $derived.by<string | null>(() => {
		void data;
		return null;
	});
	const view = $derived(
		shownTab && shownTab !== data.query.tab
			? data.other
			: { query: data.query, items: data.items, nextCursor: data.nextCursor }
	);
	const query = $derived(view.query);
	const isBookmarks = $derived(query.tab === 'bookmarks');

	function switchTab(tab: string, href: string) {
		if (tab === query.tab) return;
		shownTab = tab;
		openRow = null;
		void goto(href, { reset: false });
	}

	// Rows taken out optimistically by an action, until the reload after it lands. Writable
	// $derived: it empties itself whenever `data` reloads, when the server list is the truth.
	let hidden = $derived.by<string[]>(() => {
		void data.items;
		return [];
	});
	const items = $derived(view.items.filter((r) => !hidden.includes(r.id)));

	/** A review link that remembers this journal view (tab, search, sort, filter, and the row
	 *  itself), so the review page's back link returns here with that review selected. */
	const reviewHref = (id: string) =>
		`/review/${id}?from=${encodeURIComponent(journalHref(query, { selected: id }))}`;

	/** A row leaving after Archive / Remove / Restore / Delete slides off to the left, then the
	 *  gap closes. Rows that leave because the list changed (a new tab, search or filter) just
	 *  go, without animating. */
	const reducedMotion = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function slideAway(node: HTMLElement, id: string) {
		const reduced = reducedMotion();
		if (!hidden.includes(id) || reduced) return { duration: 0 };
		const height = node.offsetHeight;
		return {
			duration: 380,
			css: (t: number) => {
				// First 55%: slide out and fade. Then: collapse the height.
				const slide = Math.min(1, (1 - t) / 0.55);
				const collapse = Math.max(0, (0.55 - t) / 0.55);
				const ease = (x: number) => x * x * (3 - 2 * x);
				return `transform: translateX(${-ease(slide) * 100}%); opacity: ${1 - ease(slide)}; height: ${height * (1 - ease(collapse))}px;`;
			}
		};
	}

	/* ------------------------------------ actions ------------------------------------- */

	/** The one action a row offers in this list: Remove on Bookmarks, Restore in the archived
	 *  view, Archive otherwise. Swiping reveals it; the ⋯ sheet and desktop pane repeat it. */
	const rowKind = $derived<JournalActionKind>(
		isBookmarks ? 'unsave' : query.archived ? 'restore' : 'archive'
	);

	/** Only one row's swipe action is open at a time. */
	let openRow = $state<string | null>(null);
	let sheetFor = $state<FeedReview | null>(null);
	let confirmDelete = $state<FeedReview | null>(null);

	async function act(kind: JournalActionKind, review: FeedReview) {
		const spec = JOURNAL_ACTIONS[kind];
		openRow = null;
		hidden = [...hidden, review.id];
		if (!(await runJournalAction(kind, review.id))) {
			hidden = hidden.filter((id) => id !== review.id);
			toast.show(spec.failed);
			return;
		}
		toast.show(spec.done, async () => {
			if (await undoJournalAction(kind, review.id)) await invalidate('app:journal');
			else toast.show("Couldn't undo that. Try again.");
		});
		await invalidate('app:journal');
	}

	function sheetActions(review: FeedReview): SheetAction[] {
		if (isBookmarks) {
			return [
				{ label: 'Open review', icon: 'book', href: reviewHref(review.id) },
				{
					label: 'Remove bookmark',
					icon: 'bookmark',
					danger: true,
					onclick: () => act('unsave', review)
				}
			];
		}
		return [
			{ label: 'Edit review', icon: 'pencil', href: `/review/${review.id}/edit` },
			query.archived
				? { label: 'Restore to journal', icon: 'restore', onclick: () => act('restore', review) }
				: { label: 'Archive', icon: 'archive', onclick: () => act('archive', review) },
			{
				label: 'Delete review',
				icon: 'trash',
				danger: true,
				onclick: () => (confirmDelete = review)
			}
		];
	}

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

	let sortOpen = $state(false);
	let moreOpen = $state(false);
	const sortOption = $derived(JOURNAL_SORTS.find((o) => o.value === query.sort));
	/** The button shows the short form ("Price: high") so it fits beside the filter pills. */
	const sortLabel = $derived(sortOption?.short ?? sortOption?.label ?? 'Newest');

	const filtered = $derived(query.q !== '' || query.filter !== 'all');
	/** Nothing in the tab at all (not just nothing matching): the tools are hidden, and on
	 *  desktop the list shows ghost rows while the message sits in the preview pane. */
	const blank = $derived(!items.length && !filtered && !query.archived);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') sortOpen = moreOpen = false;
	}}
	onclick={(e) => {
		const t = e.target as HTMLElement;
		if (sortOpen && !t.closest('[aria-haspopup], [aria-current]')) sortOpen = false;
		if (moreOpen && !t.closest('[aria-haspopup], [role="menu"]')) moreOpen = false;
	}}
/>

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
					placeholder="Search dishes and places"
					autocomplete="off"
					class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
				/>
			</label>
		</form>
		<div class="flex items-center justify-between gap-1.5">
			<nav aria-label="Filter" class="flex min-w-0 gap-1">
				{#each JOURNAL_FILTERS as f (f.value)}
					{@const on = query.filter === f.value}
					<a
						href={journalHref(query, { filter: f.value })}
						aria-current={on ? 'true' : undefined}
						class="inline-flex h-[30px] shrink-0 items-center rounded-full border px-2.5 text-[13px] font-medium transition-colors {on
							? 'border-transparent bg-accent-soft text-accent-strong'
							: 'border-line bg-surface text-ink-2 hover:border-ink-3'}">{f.label}</a
					>
				{/each}
			</nav>
			<!-- The sort menu. Its options are links, so the chosen order is in the URL like the
			     rest of the journal's state. Closes on a pick, a click outside, or Esc. -->
			<div class="relative shrink-0">
				<button
					type="button"
					onclick={() => (sortOpen = !sortOpen)}
					aria-haspopup="true"
					aria-expanded={sortOpen}
					class="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-input pr-1 pl-1.5 text-[13px] font-semibold whitespace-nowrap text-ink transition-opacity hover:opacity-80"
				>
					<Icon name="sort" size={15} />
					<span class="sr-only">Sort:</span>
					{sortLabel}
					<Icon name="chevD" size={14} />
				</button>
				{#if sortOpen}
					<div
						class="absolute top-full right-0 z-30 mt-2 w-60 rounded-tile border border-line bg-surface p-1.5 shadow-card-lg"
					>
						<p class="px-2.5 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-ink-3 uppercase">
							Sort by
						</p>
						{#each JOURNAL_SORTS as o (o.value)}
							{@const on = query.sort === o.value}
							<a
								href={journalHref(query, { sort: o.value })}
								onclick={() => (sortOpen = false)}
								aria-current={on ? 'true' : undefined}
								class="flex min-h-11 items-center justify-between rounded-input px-2.5 text-[15px] font-medium hover:bg-sunken {on
									? 'text-accent-strong'
									: 'text-ink'}"
							>
								{o.label}
								{#if on}<Icon name="check" size={18} weight={2.4} />{/if}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

{#snippet empty()}
	<div class="flex flex-col items-center gap-2 px-7 py-11 text-center">
		<span
			class="mb-2 grid h-[72px] w-[72px] place-items-center rounded-full bg-accent-soft text-accent-strong"
		>
			<Icon
				name={filtered ? 'search' : isBookmarks ? 'bookmark' : query.archived ? 'archive' : 'logo'}
				size={28}
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
			<b class="font-display text-[22px] font-semibold text-ink">Nothing saved yet</b>
			<p class="max-w-[42ch] text-[15px] text-ink-2">
				Tap the bookmark on any review to keep it here for your next meal out.
			</p>
			<a
				href="/"
				class="mt-2 inline-flex h-11 items-center rounded-input bg-accent-soft px-5 text-[15px] font-semibold text-accent-strong hover:brightness-110"
				>Explore reviews</a
			>
		{:else if query.archived}
			<b class="font-display text-lg font-semibold text-ink">No archived reviews</b>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Reviews you archive are hidden from your profile and feed, and kept here.
			</p>
		{:else}
			<b class="font-display text-[22px] font-semibold text-ink">Your journal is empty</b>
			<p class="max-w-[42ch] text-[15px] text-ink-2">
				Write your first review and it will show up here.
			</p>
			<Button href="/review/new" class="mt-2 h-11 px-5 text-[15px]">Write a review</Button>
		{/if}
	</div>
{/snippet}

{#snippet list()}
	{#if items.length}
		<ul class="border-y border-line">
			{#each items as review (review.id)}
				<li class="overflow-hidden border-line [&+&]:border-t" out:slideAway={review.id}>
					<JournalRow
						{review}
						href={reviewHref(review.id)}
						showAuthor={isBookmarks}
						selected={selected?.id === review.id}
						onselect={selectRow}
						action={{
							label: JOURNAL_ACTIONS[rowKind].label,
							icon: JOURNAL_ACTIONS[rowKind].icon,
							tone: JOURNAL_ACTIONS[rowKind].tone,
							run: () => act(rowKind, review)
						}}
						open={openRow === review.id}
						onopenchange={(o) => (openRow = o ? review.id : null)}
						onmore={() => {
							openRow = null;
							sheetFor = review;
						}}
					/>
				</li>
			{/each}
		</ul>
		{#if view.nextCursor}
			<a
				href={journalHref(query, { cursor: view.nextCursor })}
				class="mx-auto my-3 block w-fit rounded-input px-4 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
			>
				Show more
			</a>
		{/if}
	{:else if blank}
		<div class="lg:hidden">{@render empty()}</div>
		<!-- Desktop: placeholder rows fading out, the message itself is in the preview pane. -->
		<div class="hidden px-5 pt-3 lg:block" aria-hidden="true">
			<div class="[mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
				{#each [0, 1, 2] as i (i)}
					<div class="flex items-center gap-4 border-line py-3 [&+&]:border-t">
						<span class="h-[88px] w-[88px] shrink-0 rounded-card bg-sunken"></span>
						<span class="flex flex-1 flex-col gap-2.5">
							<span class="h-4 w-1/2 rounded-full bg-sunken"></span>
							<span class="h-3 w-3/4 rounded-full bg-sunken"></span>
							<span class="h-3 w-1/3 rounded-full bg-sunken"></span>
						</span>
					</div>
				{/each}
			</div>
			<p class="mt-6 text-center text-[15px] text-ink-3">
				{isBookmarks ? 'Reviews you bookmark will show up here' : 'Your reviews will show up here'}
			</p>
		</div>
	{:else}
		{@render empty()}
	{/if}

	{#if !isBookmarks && !query.archived && data.counts.archived > 0}
		<a
			href={journalHref(query, { archived: true, q: '', filter: 'all', selected: null })}
			class="mt-auto flex min-h-11 w-full items-center gap-2 border-t border-line p-4 text-sm font-semibold text-ink-2 hover:text-ink lg:px-5"
		>
			<Icon name="archive" size={16} />
			Archived reviews
			<span class="ml-auto rounded-full bg-sunken px-2 py-px text-xs">{data.counts.archived}</span>
			<Icon name="chevR" size={16} />
		</a>
	{/if}
{/snippet}

<div class="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[440px_minmax(0,1fr)]">
	<!-- Fills the screen above the tab bar on a phone, so the Archived link can sit at the bottom. -->
	<section
		class="flex min-h-[calc(100dvh-10rem)] flex-col bg-bg lg:min-h-0 lg:border-r lg:border-line"
		aria-label="Journal list"
	>
		<div class="px-4 pt-5 pb-3 lg:px-5 lg:pt-6">
			<h1 class="font-display text-[26px] font-semibold text-ink lg:text-[28px]">My journal</h1>
		</div>
		<div class="bg-surface lg:bg-transparent lg:px-5">
			<Tabs options={tabs} current={query.tab} ariaLabel="Journal" onselect={switchTab} />
		</div>
		<div class="thin-scroll flex min-h-0 flex-1 flex-col lg:overflow-y-auto">
			<!-- Opening "Archived reviews" slides the archived list in from the right; "Back to my
			     reviews" slides the main list back in from the left. -->
			{#key query.archived}
				<div
					class="flex min-h-0 flex-1 flex-col"
					in:fly={{
						x: query.archived ? 48 : -48,
						duration: reducedMotion() ? 0 : 260,
						easing: cubicOut
					}}
				>
					{#if !blank}{@render tools()}{/if}
					{@render list()}
				</div>
			{/key}
		</div>
	</section>

	<!-- Desktop only: a read-only preview of the selected row, built from the list data already
	     loaded, so selecting a row costs no request. -->
	<section
		class="thin-scroll hidden min-h-0 overflow-y-auto bg-surface lg:block"
		aria-label="Preview"
	>
		{#if selected}
			{@const title = reviewTitle(selected)}
			{@const item = primaryItem(selected.items)}
			{@const price = totalBeforeTax(selected.items)}
			{@const total = totalWithTax(selected.items)}
			{@const details = [
				item?.cuisineLabel,
				item?.typeLabel,
				total === null ? null : `$${total.toFixed(2)} incl. tax`
			]
				.filter(Boolean)
				.join(' · ')}
			<div class="mx-auto flex max-w-[640px] flex-col gap-5 px-9 pt-7 pb-12">
				{#if selected.photos.length}
					<!-- Keyed so switching rows starts the gallery back at the cover. -->
					{#key selected.id}
						<PhotoCarousel photos={selected.photos} {title} />
					{/key}
				{/if}

				<div class="flex flex-col gap-1">
					<div class="flex items-start justify-between gap-3">
						<h2
							class="font-display text-[30px] leading-tight font-semibold tracking-tight text-balance text-ink"
						>
							{title}
						</h2>
						<div class="flex shrink-0 items-center gap-1.5">
							{#if !isBookmarks && !query.archived}
								<a
									href={`/review/${selected.id}/edit`}
									class="inline-flex h-11 items-center gap-2 rounded-input border border-line px-4 text-[15px] font-semibold text-ink transition-colors hover:border-ink-3"
								>
									<Icon name="pencil" size={16} />
									Edit
								</a>
							{/if}
							{#if isBookmarks}
								<!-- A bookmark has one action, so it gets a plain button instead of ⋯. -->
								<button
									type="button"
									onclick={() => act(rowKind, selected)}
									class="inline-flex h-11 items-center gap-2 rounded-input border border-line px-4 text-[15px] font-semibold text-ink transition-colors hover:border-ink-3"
								>
									<Icon name="bookmark" size={16} />
									Remove
								</button>
							{:else}
								<!-- The rest of the actions (Archive / Restore, Delete) live behind ⋯. -->
								<div class="relative">
									<button
										type="button"
										onclick={() => (moreOpen = !moreOpen)}
										aria-haspopup="menu"
										aria-expanded={moreOpen}
										aria-label="More actions"
										class="grid h-11 w-11 place-items-center rounded-input text-ink-2 hover:bg-sunken hover:text-ink"
									>
										<Icon name="more" size={20} />
									</button>
									{#if moreOpen}
										<div
											role="menu"
											class="absolute top-full right-0 z-30 mt-2 w-56 rounded-tile border border-line bg-surface p-1.5 shadow-card-lg"
										>
											<button
												type="button"
												role="menuitem"
												onclick={() => {
													moreOpen = false;
													act(rowKind, selected);
												}}
												class="flex min-h-11 w-full items-center gap-3 rounded-input px-2.5 text-left text-[15px] font-medium text-ink hover:bg-sunken"
											>
												<Icon name={JOURNAL_ACTIONS[rowKind].icon} size={18} />
												{JOURNAL_ACTIONS[rowKind].label}
											</button>
											<button
												type="button"
												role="menuitem"
												onclick={() => {
													moreOpen = false;
													confirmDelete = selected;
												}}
												class="flex min-h-11 w-full items-center gap-3 rounded-input px-2.5 text-left text-[15px] font-medium text-bad hover:bg-sunken"
											>
												<Icon name="trash" size={18} />
												Delete
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
					<p class="text-[15px] text-ink-2">
						{#if price !== null}<span class="font-semibold text-ink tabular-nums"
								>${price.toFixed(2)}</span
							>{#if details}&nbsp;·
							{/if}{/if}{details}
					</p>
					<a
						href={reviewHref(selected.id)}
						class="mt-2 inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-accent-strong hover:underline"
					>
						Open full review
						<Icon name="chevR" size={16} weight={2.4} />
					</a>
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
		{:else if blank}
			<div class="grid h-full place-items-center">{@render empty()}</div>
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

<ActionSheet
	open={sheetFor !== null}
	title={sheetFor ? reviewTitle(sheetFor) : ''}
	actions={sheetFor ? sheetActions(sheetFor) : []}
	onclose={() => (sheetFor = null)}
/>

<ConfirmDialog
	open={confirmDelete !== null}
	title="Delete review"
	message="Delete your review permanently?"
	confirmLabel="Delete"
	onconfirm={() => {
		const review = confirmDelete;
		if (review) act('delete', review);
	}}
	onclose={() => (confirmDelete = null)}
/>
