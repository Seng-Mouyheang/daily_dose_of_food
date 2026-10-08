<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ItemForm from './ItemForm.svelte';
	import CategoryRatingBlock from './CategoryRatingBlock.svelte';
	import { ratingWord } from '#lib/review/format.ts';
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
		drinkTypes,
		dishNameInvalid = false,
		drinkNameInvalid = false,
		onDismiss
	}: {
		draft: ReviewDraft;
		categories: RatingCategoryView[];
		cuisineTypes: { id: number; name: string }[];
		foodTypes: { id: number; name: string }[];
		drinkTypes: { id: number; name: string }[];
		dishNameInvalid?: boolean;
		drinkNameInvalid?: boolean;
		onDismiss?: () => void;
	} = $props();

	const foodCategory = $derived(itemCategoriesFor(categories, 'food')[0]);
	const drinkCategory = $derived(itemCategoriesFor(categories, 'drink')[0]);
	const placeCategories = $derived(placeCategoriesFor(categories, draft.visitType));

	// Seeding (ensureRating mutates) must happen in an effect, not a derived/template
	// expression — see ensureRating's doc comment. This seeds both the place-level categories
	// and each item's own quality category, re-running whenever visit type or review type
	// changes what's in play (e.g. switching visit type adds/drops Amenities).
	$effect(() => {
		for (const c of placeCategories) ensureRating(draft.placeRatings, c.id);
		if (draft.hasDish && foodCategory) ensureRating(draft.dish.ratings, foodCategory.id);
		if (draft.hasBev && drinkCategory) ensureRating(draft.drink.ratings, drinkCategory.id);
	});
	const placeRatings = $derived(placeCategories.map((c) => findRating(draft.placeRatings, c.id)));
	const dishRating = $derived(
		foodCategory ? findRating(draft.dish.ratings, foodCategory.id) : null
	);
	const drinkRating = $derived(
		drinkCategory ? findRating(draft.drink.ratings, drinkCategory.id) : null
	);

	const overallAverage = $derived.by(() => {
		const all = [...draft.placeRatings, ...draft.dish.ratings, ...draft.drink.ratings];
		const values = all.flatMap((r) => (r.ratingValue === null ? [] : [r.ratingValue]));
		if (values.length === 0) return null;
		return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2;
	});
	const categoryAverage = $derived.by(() => {
		const all = [...draft.placeRatings, ...draft.dish.ratings, ...draft.drink.ratings];
		const values = all.flatMap((r) => (r.ratingValue === null ? [] : [r.ratingValue]));
		if (values.length === 0) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	});
</script>

<div class="flex flex-col gap-7">
	{#if draft.hasDish}
		<ItemForm
			item={draft.dish}
			{cuisineTypes}
			{foodTypes}
			{drinkTypes}
			invalid={dishNameInvalid}
			{onDismiss}
		/>
	{/if}
	{#if draft.hasBev}
		<ItemForm
			item={draft.drink}
			{cuisineTypes}
			{foodTypes}
			{drinkTypes}
			invalid={drinkNameInvalid}
			{onDismiss}
		/>
	{/if}

	<div class="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
		<div class="flex flex-col gap-1">
			<h3 class="font-display text-lg font-semibold text-ink">How was it?</h3>
			<p class="text-[13px] text-ink-3">
				Green tags are highlights, red tags are complaints. Both show on your card.
			</p>
		</div>
		{#if draft.hasDish && foodCategory && dishRating}
			<CategoryRatingBlock
				category={foodCategory}
				rating={dishRating}
				visitType={draft.visitType}
			/>
		{/if}
		{#if draft.hasBev && drinkCategory && drinkRating}
			<CategoryRatingBlock
				category={drinkCategory}
				rating={drinkRating}
				visitType={draft.visitType}
			/>
		{/if}
		{#each placeCategories as category, i (category.id)}
			<CategoryRatingBlock {category} rating={placeRatings[i]} visitType={draft.visitType} />
		{/each}
	</div>

	{#if overallAverage !== null}
		<div
			class="flex flex-col items-center gap-2 rounded-card border border-accent-soft bg-accent-soft p-6 text-center"
		>
			<span class="text-sm font-semibold text-ink">Overall rating</span>
			<Stars value={overallAverage} size={28} />
			<span class="font-display text-lg font-semibold text-ink">{ratingWord(overallAverage)}</span>
			<span class="text-sm text-ink-3">Your category average is {categoryAverage?.toFixed(1)}</span>
		</div>
	{/if}

	<label
		class="flex cursor-pointer items-center justify-between rounded-card border border-line bg-surface p-4"
	>
		<span class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-full bg-fav-soft text-fav">
				<Icon name="heart" size={18} />
			</span>
			<span class="flex flex-col">
				<span class="text-sm font-semibold text-ink">Add to favorites</span>
				<span class="text-[13px] text-ink-3">Keep it on your favorites shelf</span>
			</span>
		</span>
		<Toggle bind:checked={draft.isFavorite} label="Add to favorites" tone="fav" />
	</label>

	<Field label="Notes" optional for="f-notes" hint="What would you tell a friend about it?">
		<div class="relative">
			<textarea
				id="f-notes"
				maxlength="500"
				rows="4"
				class="w-full rounded-input border border-line bg-surface px-3.5 py-3 text-[15px] text-ink outline-none focus-within:border-accent"
				bind:value={draft.description}></textarea>
			<p class="pointer-events-none absolute right-3 bottom-2.5 text-xs text-ink-3">
				{draft.description.length}/500
			</p>
		</div>
	</Field>
</div>
