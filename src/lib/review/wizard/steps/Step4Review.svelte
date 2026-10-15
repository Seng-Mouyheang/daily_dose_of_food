<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import VisibilityPicker from './VisibilityPicker.svelte';
	import { formatVisitDate, priceWithTax, resolveTypeLabel } from '#lib/review/format.ts';
	import type { CategoryRatingDraft, ItemDraft, ReviewDraft } from '#lib/review/draft.svelte.ts';
	import { placeCategoriesFor, type RatingCategoryView } from '#lib/review/categories.ts';

	let {
		draft,
		categories,
		cuisineTypes,
		foodTypes,
		drinkTypes,
		onEdit
	}: {
		draft: ReviewDraft;
		categories: RatingCategoryView[];
		cuisineTypes: { id: number; name: string }[];
		foodTypes: { id: number; name: string }[];
		drinkTypes: { id: number; name: string }[];
		onEdit: (step: number) => void;
	} = $props();

	const visitLabel: Record<string, string> = {
		dine_in: 'Dine-in',
		takeaway: 'Takeaway',
		delivery: 'Delivery'
	};

	const reviewTypeLabel: Record<string, string> = {
		dish: 'Dish',
		beverage: 'Drink',
		both: 'Both'
	};

	const visitPills = $derived(
		[
			reviewTypeLabel[draft.reviewType],
			visitLabel[draft.visitType],
			draft.hasDish ? draft.mealType.charAt(0).toUpperCase() + draft.mealType.slice(1) : null,
			formatVisitDate(draft.visitedAt)
		].filter((p): p is string => Boolean(p))
	);

	function itemSummary(item: ItemDraft) {
		const hasPrice = parseFloat(item.price) > 0;
		const typeLabel =
			item.itemType === 'food'
				? [
						resolveTypeLabel(item.cuisineTypeId, item.cuisineTypeOther, cuisineTypes),
						resolveTypeLabel(item.foodTypeIds[0] ?? null, item.foodTypeOther, foodTypes)
					]
						.filter((l): l is string => Boolean(l))
						.join(' · ') || null
				: resolveTypeLabel(item.drinkTypeId, item.drinkTypeOther, drinkTypes);
		return {
			name: item.itemName || `Untitled ${item.itemType}`,
			typeLabel,
			price: hasPrice ? item.price : null,
			taxPercent: item.taxPercent,
			total: priceWithTax(item.price, item.taxPercent)
		};
	}

	interface RatingWithCategory {
		rating: CategoryRatingDraft;
		category: RatingCategoryView;
	}

	// draft.placeRatings/dish.ratings/drink.ratings only ever grow (ensureRating in Step 2 seeds
	// an entry but never removes one), so switching visit type away from one that had Amenities
	// applicable, or switching review type away from "Both", leaves a stale rating sitting in
	// the array for a category/item that's no longer in play. The server drops exactly these
	// when publishing — applicablePlaceCategoryIds/applicableItemCategoryIds in reviews.ts, and
	// payload.ts only ever sends whichever item(s) draft.hasDish/draft.hasBev say are active — so
	// this mirrors both filters to keep the review-before-you-publish summary honest about what's
	// actually sent.
	const applicableRatings = $derived.by((): RatingWithCategory[] => {
		const placeCategoryIds = new Set(
			placeCategoriesFor(categories, draft.visitType).map((c) => c.id)
		);
		const combined = [
			...draft.placeRatings.filter((r) => placeCategoryIds.has(r.ratingCategoryId)),
			...(draft.hasDish ? draft.dish.ratings : []),
			...(draft.hasBev ? draft.drink.ratings : [])
		];
		const out: RatingWithCategory[] = [];
		for (const rating of combined) {
			const category = categories.find((c) => c.id === rating.ratingCategoryId);
			if (category) out.push({ rating, category });
		}
		return out;
	});

	// All applicable ratings with an actual star value — Step 2 seeds a null-valued entry for
	// every applicable category up front, so one the user never actually rated still has an
	// array entry; skip it rather than showing an empty-stars row for a category they never
	// touched.
	const allRatings = $derived(applicableRatings.filter((r) => r.rating.ratingValue !== null));

	// Same as allRatings, but also keeps tag-only ratings (starred or not) — payload.ts and
	// ReviewCard both publish/display a category's tags independently of whether it was ever
	// starred, so the tag chips here must match rather than silently dropping unstarred ones.
	const taggedRatings = $derived(
		applicableRatings.filter((r) => r.rating.criteriaOptionIds.length > 0)
	);

	const overallRating = $derived.by(() => {
		const values = allRatings.flatMap((r) =>
			r.rating.ratingValue === null ? [] : [r.rating.ratingValue]
		);
		if (values.length === 0) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	});

	const positiveTags = $derived(
		taggedRatings.flatMap(({ rating, category }) =>
			category.positive.filter((o) => rating.criteriaOptionIds.includes(o.id)).map((o) => o.label)
		)
	);
	const negativeTags = $derived(
		taggedRatings.flatMap(({ rating, category }) =>
			category.negative.filter((o) => rating.criteriaOptionIds.includes(o.id)).map((o) => o.label)
		)
	);
</script>

<div class="flex flex-col gap-6">
	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Visit</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(1)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>

		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each visitPills as pill (pill)}
				<span class="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2"
					>{pill}</span
				>
			{/each}
		</div>

		<div class="mt-3 flex items-start gap-2.5">
			<span
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-accent-soft text-accent-strong"
			>
				<Icon name="pin" size={16} />
			</span>
			<div class="text-sm">
				<p class="font-semibold text-ink">{draft.place?.name ?? (draft.newPlaceName || '—')}</p>
				{#if draft.place?.addressLine1}<p class="text-ink-3">{draft.place.addressLine1}</p>{/if}
			</div>
		</div>
	</section>

	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Rating & details</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(2)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>

		{#each draft.items as item (item.itemType)}
			{@const summary = itemSummary(item)}
			<div class="mt-3 flex items-start justify-between gap-2">
				<div>
					<p class="font-semibold text-ink">{summary.name}</p>
					{#if summary.typeLabel}
						<p class="text-xs text-ink-3">{summary.typeLabel}</p>
					{/if}
				</div>
				{#if summary.price}
					<div class="shrink-0 text-right">
						<p class="font-semibold text-ink tabular-nums">${summary.total.toFixed(2)}</p>
						<p class="text-xs text-ink-3">
							${summary.price}{#if summary.taxPercent}
								+ {summary.taxPercent}% tax{/if}
						</p>
					</div>
				{/if}
			</div>
		{/each}

		<div class="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
			<div class="flex items-center justify-between">
				<span class="font-semibold text-ink">Overall</span>
				<span class="flex items-center gap-2">
					<Stars value={overallRating} size={16} />
					{#if overallRating !== null}<b class="text-ink tabular-nums">{overallRating.toFixed(1)}</b
						>{/if}
				</span>
			</div>
			{#each allRatings as { rating, category } (category.id)}
				<div class="flex items-center justify-between text-ink-2">
					<span>{category.name}</span>
					<Stars value={rating.ratingValue} size={14} />
				</div>
			{/each}
		</div>

		{#if positiveTags.length || negativeTags.length}
			<div class="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
				{#each positiveTags as tag (tag)}
					<span class="rounded-full bg-good-soft px-2.5 py-1 text-xs font-medium text-good"
						>+ {tag}</span
					>
				{/each}
				{#each negativeTags as tag (tag)}
					<span class="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-medium text-bad"
						>− {tag}</span
					>
				{/each}
			</div>
		{/if}

		{#if draft.description}
			<p class="mt-3 border-l-2 border-line pl-3 text-sm text-ink-2 italic">
				"{draft.description}"
			</p>
		{/if}

		{#if draft.isFavorite}
			<p class="mt-3 flex items-center gap-1.5 text-sm font-semibold text-fav">
				<Icon name="heart" size={14} /> In your favorites
			</p>
		{/if}
	</section>

	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Photos</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(3)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>
		{#if draft.photos.length}
			<div class="mt-3 grid grid-cols-4 gap-2">
				{#each draft.photos.slice(0, 4) as photo (photo.publicId)}
					<div class="relative aspect-[4/3] overflow-hidden rounded-[10px]">
						<img src={photo.previewUrl} alt="" class="h-full w-full object-cover" />
						{#if photo.isCover}
							<span
								class="absolute top-1 left-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-on-accent uppercase"
								>Cover</span
							>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-sm text-ink-3">No photos added.</p>
		{/if}
	</section>

	<div class="lg:hidden">
		<VisibilityPicker bind:value={draft.visibility} />
	</div>
</div>
