<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import StarRating from '#lib/components/StarRating.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import { categoryIcon, categoryLabel, type RatingCategoryView } from '#lib/review/categories.ts';
	import type { CategoryRatingDraft, VisitType } from '#lib/review/draft.svelte.ts';

	let {
		category,
		rating,
		visitType
	}: { category: RatingCategoryView; rating: CategoryRatingDraft; visitType: VisitType } = $props();

	const label = $derived(categoryLabel(category, visitType));

	function toggleTag(id: number) {
		const i = rating.criteriaOptionIds.indexOf(id);
		if (i === -1) rating.criteriaOptionIds.push(id);
		else rating.criteriaOptionIds.splice(i, 1);
	}
</script>

<div class="flex flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="flex items-center gap-2 text-sm font-semibold text-ink">
			<Icon name={categoryIcon(category.slug)} size={18} class="text-ink-3" />
			{label}
		</span>
		<StarRating bind:value={rating.ratingValue} size={20} label={`${label} rating`} />
	</div>
	{#if category.positive.length || category.negative.length}
		<div class="flex flex-wrap gap-1.5">
			{#each category.positive as option (option.id)}
				<Chip
					label={option.label}
					variant="pos"
					selected={rating.criteriaOptionIds.includes(option.id)}
					onclick={() => toggleTag(option.id)}
				/>
			{/each}
			{#each category.negative as option (option.id)}
				<Chip
					label={option.label}
					variant="neg"
					selected={rating.criteriaOptionIds.includes(option.id)}
					onclick={() => toggleTag(option.id)}
				/>
			{/each}
		</div>
	{/if}
</div>
