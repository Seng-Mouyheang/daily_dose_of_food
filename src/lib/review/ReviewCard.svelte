<script lang="ts">
	import type { NestedRatingCategory } from '#lib/server/lookups.ts';
	import Icon from '../components/Icon.svelte';
	import type { ReviewDraftSnapshot } from './payload.ts';

	let { draft, categories }: { draft: ReviewDraftSnapshot; categories: NestedRatingCategory[] } =
		$props();

	const cover = $derived(draft.photos.find((p) => p.isCover) ?? draft.photos[0] ?? null);
	const allRatings = $derived([
		...draft.placeRatings,
		...draft.dish.ratings,
		...draft.drink.ratings
	]);

	const overallRating = $derived.by(() => {
		const values = allRatings.flatMap((r) => (r.ratingValue === null ? [] : [r.ratingValue]));
		if (values.length === 0) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	});

	const tags = $derived.by(() => {
		const labels: string[] = [];
		for (const rating of allRatings) {
			const category = categories.find((c) => c.id === rating.ratingCategoryId);
			if (!category) continue;
			const options = [...category.positive, ...category.negative];
			for (const optionId of rating.criteriaOptionIds) {
				const option = options.find((o) => o.id === optionId);
				if (option) labels.push(option.label);
			}
		}
		return labels;
	});

	const itemName = $derived(draft.dish.itemName || draft.drink.itemName || 'Untitled review');
	const placeLabel = $derived(draft.place?.name ?? (draft.newPlaceName || 'Choose a place'));

	const price = $derived.by(() => {
		const prices = [parseFloat(draft.dish.price), parseFloat(draft.drink.price)].filter(
			Number.isFinite
		);
		return prices.reduce((a, b) => a + b, 0);
	});

	const visitLabel: Record<string, string> = {
		dine_in: 'Dine-in',
		takeaway: 'Takeaway',
		delivery: 'Delivery'
	};
</script>

<article class="overflow-hidden rounded-card border border-line bg-surface shadow-card">
	<header class="flex items-center gap-2 px-4 pt-4">
		<div class="h-8 w-8 rounded-full bg-sunken"></div>
		<span class="text-sm font-semibold text-ink">You</span>
		<span class="text-xs text-ink-3">· {placeLabel} · {visitLabel[draft.visitType]}</span>
	</header>

	<div class="relative mx-4 mt-3 aspect-[16/10] overflow-hidden rounded-[12px] bg-sunken">
		{#if cover}
			<img src={cover.previewUrl} alt="" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center text-ink-3">
				<Icon name="camera" size={28} />
			</div>
		{/if}
		{#if overallRating !== null}
			<span
				class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-ink shadow-card"
			>
				★ {overallRating.toFixed(1)}
			</span>
		{/if}
		{#if draft.isFavorite}
			<span
				class="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-fav px-2 py-1 text-xs font-bold text-white"
			>
				♥ Favorite
			</span>
		{/if}
		{#if draft.photos.length > 1}
			<span
				class="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white"
			>
				1/{draft.photos.length}
			</span>
		{/if}
	</div>

	<div class="px-4 pt-3">
		<div class="flex items-baseline justify-between gap-2">
			<h3 class="font-display text-lg font-semibold text-balance text-ink">{itemName}</h3>
			{#if price > 0}
				<span class="shrink-0 font-semibold text-ink tabular-nums">${price.toFixed(2)}</span>
			{/if}
		</div>

		{#if tags.length}
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each tags.slice(0, 4) as tag (tag)}
					<span class="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{tag}</span>
				{/each}
				{#if tags.length > 4}
					<span class="rounded-full border border-line px-2 py-0.5 text-xs text-ink-3"
						>+{tags.length - 4} more</span
					>
				{/if}
			</div>
		{/if}

		{#if draft.description}
			<p class="mt-2 line-clamp-3 text-sm text-ink-2">{draft.description}</p>
		{/if}
	</div>

	<footer class="flex items-center justify-between px-4 py-3 text-xs text-ink-3">
		<span>{draft.visitedAt}</span>
		<span class="capitalize">{draft.visibility}</span>
	</footer>
</article>
