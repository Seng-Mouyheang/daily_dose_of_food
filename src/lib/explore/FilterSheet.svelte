<script lang="ts">
	/** Explore's Filters panel: a bottom sheet on a phone, a centered 480px dialog on desktop.
	 *  Every section reads and writes the same URL filter state as the quick chips, so they always
	 *  agree.
	 *
	 *  A native <dialog> like ActionSheet (top layer, focus trap, Esc and the backdrop close it).
	 *  Each choice is a link that replaces the URL without scrolling or moving focus: the grid
	 *  behind updates live, and the sheet — the same element across the navigation — keeps its
	 *  own scroll position. Closing just closes; there's nothing to apply. */
	import type { Snippet } from 'svelte';
	import FilterPill from '#lib/components/FilterPill.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import {
		activeCount,
		EMPTY_FILTERS,
		type ExploreFacet,
		type ExploreFilters,
		MEALS,
		priceLabel,
		ratingLabel,
		SORTS,
		toggleValue
	} from './explore.ts';

	let {
		open,
		filters,
		facets,
		matchCount,
		query = '',
		hrefFor,
		onclose
	}: {
		open: boolean;
		filters: ExploreFilters;
		facets: { cuisines: ExploreFacet[]; kinds: ExploreFacet[] };
		matchCount: number;
		/** The search, when the panel narrows search results. */
		query?: string;
		/** The page URL for a filter state (Explore keeps its search and tab in it). */
		hrefFor: (filters: ExploreFilters) => string;
		onclose: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Replace the history entry, and keep scroll and focus where they are (`reset="false"`).
	const nav = {
		'data-sveltekit-replacestate': '',
		'data-sveltekit-reset': 'false'
	} as const;

	const PRICES = [0, 3, 5, 8, 12] as const;
	const RATINGS = [0, 3, 4, 5] as const;
	const TYPES = [
		{ value: 'any', label: 'Anything' },
		{ value: 'food', label: 'Food' },
		{ value: 'drink', label: 'Drinks' }
	] as const;

	const anySet = $derived(activeCount(filters) > 0 || filters.sort !== 'new');
</script>

{#snippet section(title: string, body: Snippet)}
	<div class="flex flex-col gap-2">
		<p class="text-xs font-bold tracking-[.06em] text-ink-3 uppercase">{title}</p>
		<div class="flex flex-wrap gap-1.5">{@render body()}</div>
	</div>
{/snippet}

{#snippet multi(key: 'meals' | 'cuisines' | 'kinds', value: string, label: string)}
	{@const on = (filters[key] as string[]).includes(value)}
	<FilterPill
		href={hrefFor(toggleValue(filters, key, value as never))}
		{label}
		selected={on}
		icon={on ? 'check' : undefined}
		{...nav}
	/>
{/snippet}

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-label="Filters"
	class="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 lg:m-auto lg:w-[480px]"
>
	<div
		class="flex max-h-[86dvh] flex-col overflow-y-auto rounded-t-[20px] bg-surface px-4.5 pt-2 text-ink lg:max-h-[calc(100dvh-48px)] lg:rounded-[18px] lg:px-5.5 lg:pt-5"
	>
		<div
			class="mx-auto mt-0.5 h-1 w-10 shrink-0 rounded-full bg-line lg:hidden"
			aria-hidden="true"
		></div>

		<div class="mt-3 flex items-start justify-between gap-2.5 lg:mt-0">
			<div>
				<h2 class="font-display text-[19px] font-semibold">Filters</h2>
				<p class="mt-0.5 text-[13.5px] text-ink-2">
					{query ? `For food matching “${query}”` : 'Find exactly what you feel like.'}
				</p>
			</div>
			<button
				type="button"
				onclick={onclose}
				aria-label="Close"
				class="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-[10px] text-ink-2 hover:bg-sunken"
			>
				<Icon name="x" size={18} weight={2.2} />
			</button>
		</div>

		<div class="mt-3.5 flex flex-col gap-3.5">
			{#snippet sorts()}
				{#each SORTS as s (s.value)}
					<FilterPill
						href={hrefFor({ ...filters, sort: s.value })}
						label={s.label}
						selected={filters.sort === s.value}
						{...nav}
					/>
				{/each}
			{/snippet}
			{@render section('Sort by', sorts)}

			{#snippet meals()}
				{#each MEALS as m (m.value)}{@render multi('meals', m.value, m.label)}{/each}
			{/snippet}
			{@render section('Meal', meals)}

			{#snippet types()}
				{#each TYPES as t (t.value)}
					<FilterPill
						href={hrefFor({ ...filters, type: t.value })}
						label={t.label}
						selected={filters.type === t.value}
						{...nav}
					/>
				{/each}
			{/snippet}
			{@render section('Food or drink', types)}

			{#if facets.cuisines.length}
				{#snippet cuisines()}
					{#each facets.cuisines as c (c.slug)}{@render multi('cuisines', c.slug, c.name)}{/each}
				{/snippet}
				{@render section('Cuisine', cuisines)}
			{/if}

			{#if facets.kinds.length}
				{#snippet kinds()}
					{#each facets.kinds as k (k.slug)}{@render multi('kinds', k.slug, k.name)}{/each}
				{/snippet}
				{@render section('Dish or drink', kinds)}
			{/if}

			{#snippet prices()}
				{#each PRICES as p (p)}
					<FilterPill
						href={hrefFor({ ...filters, maxPrice: p })}
						label={priceLabel(p)}
						selected={filters.maxPrice === p}
						{...nav}
					/>
				{/each}
			{/snippet}
			{@render section('Price', prices)}

			{#snippet ratings()}
				{#each RATINGS as r (r)}
					<FilterPill
						href={hrefFor({ ...filters, rating: r })}
						label={ratingLabel(r)}
						selected={filters.rating === r}
						{...nav}
					/>
				{/each}
			{/snippet}
			{@render section('Rating', ratings)}

			{#snippet from()}
				<FilterPill
					href={hrefFor({ ...filters, from: 'all' })}
					label="Everyone"
					selected={filters.from === 'all'}
					{...nav}
				/>
				<FilterPill
					href={hrefFor({ ...filters, from: 'following' })}
					label="People I follow"
					selected={filters.from === 'following'}
					{...nav}
				/>
				<span class="mx-1 w-px self-stretch bg-line" aria-hidden="true"></span>
				<FilterPill
					href={hrefFor({ ...filters, photos: !filters.photos })}
					label="Has photos"
					selected={filters.photos}
					icon="camera"
					{...nav}
				/>
			{/snippet}
			{@render section('From', from)}
		</div>

		<!-- Sticky, so Reset and the result count stay in reach while the sections scroll. -->
		<div
			class="sticky bottom-0 -mx-4.5 mt-4 flex items-center justify-between gap-3 border-t border-line bg-surface px-4.5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))] lg:-mx-5.5 lg:px-5.5"
		>
			{#if anySet}
				<a
					href={hrefFor(EMPTY_FILTERS)}
					{...nav}
					class="rounded-lg px-1.5 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
					>Reset all</a
				>
			{:else}
				<span
					class="px-1.5 py-2 text-sm font-semibold text-accent-strong opacity-50"
					aria-disabled="true">Reset all</span
				>
			{/if}
			<button
				type="button"
				onclick={onclose}
				class="inline-flex h-[50px] max-w-[260px] flex-1 items-center justify-center rounded-[14px] bg-accent px-5 text-[15.5px] font-bold text-on-accent transition-[filter] hover:brightness-90"
			>
				{matchCount
					? `Show ${matchCount} review${matchCount === 1 ? '' : 's'}`
					: 'No reviews match'}
			</button>
		</div>
	</div>
</dialog>

<style>
	.sheet::backdrop {
		background: var(--scrim);
	}
	.sheet[open] > div {
		animation: sheet-up 0.22s ease;
	}
	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
	}
	@media (min-width: 64rem) {
		.sheet[open] > div {
			animation: sheet-fade 0.15s ease;
		}
	}
	@keyframes sheet-fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet[open] > div {
			animation: none;
		}
	}
</style>
