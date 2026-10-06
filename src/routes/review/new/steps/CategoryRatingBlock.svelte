<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import StarRating from '#lib/components/StarRating.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import { ratingWord } from '#lib/review/format.ts';
	import { categoryIcon, categoryLabel, type RatingCategoryView } from '#lib/review/categories.ts';
	import type { CategoryRatingDraft, VisitType } from '#lib/review/draft.svelte.ts';

	let {
		category,
		rating,
		visitType
	}: { category: RatingCategoryView; rating: CategoryRatingDraft; visitType: VisitType } = $props();

	const label = $derived(categoryLabel(category, visitType));
	const word = $derived(ratingWord(rating.ratingValue));

	let expanded = $state(false);

	const allOptions = $derived([...category.positive, ...category.negative]);
	const selectedOptions = $derived(
		allOptions.filter((o) => rating.criteriaOptionIds.includes(o.id))
	);
	const selectedPositiveIds = $derived(new Set(category.positive.map((o) => o.id)));

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
			{#if word}<span class="font-normal text-ink-3">{word}</span>{/if}
		</span>
		<StarRating bind:value={rating.ratingValue} size={20} label={`${label} rating`} />
	</div>

	{#if allOptions.length}
		{#if !expanded}
			<div class="flex flex-wrap gap-1.5">
				{#each selectedOptions as option (option.id)}
					<Chip
						label={option.label}
						variant={selectedPositiveIds.has(option.id) ? 'pos' : 'neg'}
						selected
						onclick={() => toggleTag(option.id)}
					/>
				{/each}
				<Chip label="Edit tags" variant="add" onclick={() => (expanded = true)} />
			</div>
		{:else}
			<div class="flex flex-col gap-3 rounded-input bg-sunken p-3.5">
				{#if category.positive.length}
					<div class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold tracking-wide text-ink-3 uppercase"
							>What was good</span
						>
						<div class="flex flex-wrap gap-1.5">
							{#each category.positive as option (option.id)}
								<Chip
									label={option.label}
									variant="pos"
									selected={rating.criteriaOptionIds.includes(option.id)}
									onclick={() => toggleTag(option.id)}
								/>
							{/each}
						</div>
					</div>
				{/if}
				{#if category.negative.length}
					<div class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold tracking-wide text-ink-3 uppercase"
							>What could be better</span
						>
						<div class="flex flex-wrap gap-1.5">
							{#each category.negative as option (option.id)}
								<Chip
									label={option.label}
									variant="neg"
									selected={rating.criteriaOptionIds.includes(option.id)}
									onclick={() => toggleTag(option.id)}
								/>
							{/each}
						</div>
					</div>
				{/if}
				<button
					type="button"
					class="flex w-fit items-center gap-1 text-sm font-semibold text-accent-strong"
					onclick={() => (expanded = false)}
				>
					<Icon name="check" size={14} weight={3} />
					Done
				</button>
			</div>
		{/if}
	{/if}
</div>
