<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import { categoryIcon } from './categories.ts';
	import { ratingWord } from './format.ts';
	import { aggregateCategoryRatings, type FeedCategoryRating } from './card.ts';

	/** The review page's score block: the overall rating large, then one bar per category.
	 *
	 *  Bars rather than a second row of stars. The overall rating above is already five orange
	 *  stars; repeating that shape six more times directly underneath makes the one number that
	 *  matters compete with six that don't, and reading a 3-vs-4 difference across stacked star
	 *  rows is harder than reading two bar lengths. */
	let {
		overallRating,
		categoryRatings
	}: { overallRating: number; categoryRatings: FeedCategoryRating[] } = $props();

	const rows = $derived(aggregateCategoryRatings(categoryRatings));
</script>

<section class="rounded-card border border-line bg-surface p-5">
	<div class="flex items-center gap-4">
		<p class="font-display text-[42px] leading-none font-semibold text-ink tabular-nums">
			{overallRating.toFixed(1)}
		</p>
		<div>
			<Stars value={overallRating} size={20} />
			<p class="mt-1 text-[13.5px] text-ink-2">{ratingWord(overallRating)} overall</p>
		</div>
	</div>

	{#if rows.length}
		<ul class="mt-4 flex flex-col gap-3 border-t border-line pt-4">
			{#each rows as row (row.slug)}
				<li class="grid grid-cols-[minmax(0,1fr)_34%_26px] items-center gap-3">
					<span class="flex items-center gap-2 text-sm text-ink">
						<Icon name={categoryIcon(row.slug)} size={17} class="text-ink-3" />
						<span class="truncate">{row.name}</span>
					</span>
					<!-- The number to the right is the accessible value; the bar is presentation. -->
					<span class="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
						<span
							class="block h-full rounded-full bg-accent"
							style={`width: ${(row.value / 5) * 100}%`}
						></span>
					</span>
					<span class="text-right text-sm font-semibold text-ink tabular-nums">
						{row.value.toFixed(1)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
