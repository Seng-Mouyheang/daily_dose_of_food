<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import ItemForm from './ItemForm.svelte';
	import CategoryRatingBlock from './CategoryRatingBlock.svelte';
	import { ensureRating, findRating, type ReviewDraft } from '#lib/review/draft.svelte.ts';
	import {
		itemCategoriesFor,
		placeCategoriesFor,
		type RatingCategoryView
	} from '#lib/review/categories.ts';

	let {
		draft,
		categories,
		cuisineTypes,
		foodTypes,
		drinkTypes
	}: {
		draft: ReviewDraft;
		categories: RatingCategoryView[];
		cuisineTypes: { id: number; name: string }[];
		foodTypes: { id: number; name: string }[];
		drinkTypes: { id: number; name: string }[];
	} = $props();

	const foodCategory = $derived(itemCategoriesFor(categories, 'food')[0]);
	const drinkCategory = $derived(itemCategoriesFor(categories, 'drink')[0]);
	const placeCategories = $derived(placeCategoriesFor(categories, draft.visitType));

	// Seeding (ensureRating mutates) must happen in an effect, not a derived/template
	// expression — see ensureRating's doc comment. This runs before the first paint and again
	// whenever placeCategories changes (e.g. switching visit type adds/drops Amenities).
	$effect(() => {
		for (const c of placeCategories) ensureRating(draft.placeRatings, c.id);
	});
	const placeRatings = $derived(placeCategories.map((c) => findRating(draft.placeRatings, c.id)));

	const overallAverage = $derived.by(() => {
		const all = [...draft.placeRatings, ...draft.dish.ratings, ...draft.drink.ratings];
		const values = all.flatMap((r) => (r.ratingValue === null ? [] : [r.ratingValue]));
		if (values.length === 0) return null;
		return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2;
	});

	const STAR_PATH =
		'M12 2.6l2.85 6 6.55.78-4.85 4.5 1.3 6.5L12 17.1l-5.85 3.28 1.3-6.5L2.6 9.38l6.55-.78z';
</script>

<div class="flex flex-col gap-7">
	{#if draft.reviewType === 'both'}
		<div class="flex flex-col gap-1">
			<h3 class="font-display text-lg font-semibold text-ink">What you ordered</h3>
			<p class="text-[13px] text-ink-3">Two items — rate each one separately.</p>
		</div>
	{/if}

	{#if draft.hasDish}
		<ItemForm
			item={draft.dish}
			visitType={draft.visitType}
			category={foodCategory}
			{cuisineTypes}
			{foodTypes}
			{drinkTypes}
		/>
	{/if}
	{#if draft.hasBev}
		<ItemForm
			item={draft.drink}
			visitType={draft.visitType}
			category={drinkCategory}
			{cuisineTypes}
			{foodTypes}
			{drinkTypes}
		/>
	{/if}

	<div class="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
		<div class="flex flex-col gap-1">
			<h3 class="font-display text-lg font-semibold text-ink">How was it?</h3>
			<p class="text-[13px] text-ink-3">
				Green tags are highlights, red tags are complaints. Both show on your card.
			</p>
		</div>
		{#each placeCategories as category, i (category.id)}
			<CategoryRatingBlock {category} rating={placeRatings[i]} visitType={draft.visitType} />
		{/each}
	</div>

	{#if overallAverage !== null}
		<div
			class="flex items-center justify-between rounded-card border border-accent-soft bg-accent-soft p-4"
		>
			<span class="text-sm font-semibold text-ink">Overall</span>
			<div class="flex items-center gap-2">
				<div class="flex" aria-hidden="true">
					{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="currentColor"
							class={i < Math.round(overallAverage) ? 'text-accent' : 'text-star-empty'}
						>
							<path d={STAR_PATH} />
						</svg>
					{/each}
				</div>
				<span class="text-sm font-medium text-ink-2">{overallAverage.toFixed(1)} average</span>
			</div>
		</div>
	{/if}

	<label
		class="flex cursor-pointer items-center justify-between rounded-card border border-line bg-surface p-4"
	>
		<span class="flex flex-col">
			<span class="text-sm font-semibold text-ink">Favorite</span>
			<span class="text-[13px] text-ink-3">Keep it on your favorites shelf</span>
		</span>
		<input type="checkbox" class="h-5 w-5 accent-accent" bind:checked={draft.isFavorite} />
	</label>

	<Field label="Notes" optional for="f-notes" hint="What would you tell a friend about it?">
		<textarea
			id="f-notes"
			maxlength="500"
			rows="4"
			class="rounded-input border border-line bg-surface px-3.5 py-3 text-[15px] text-ink outline-none focus-within:border-accent"
			bind:value={draft.description}></textarea>
		<p class="text-right text-xs text-ink-3">{draft.description.length}/500</p>
	</Field>
</div>
