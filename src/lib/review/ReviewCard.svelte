<script lang="ts">
	import type { NestedRatingCategory } from '#lib/server/lookups.ts';
	import Icon from '../components/Icon.svelte';
	import { STAR_PATH } from '../components/star-path.ts';
	import { formatVisitDate } from './format.ts';
	import type { ReviewDraftSnapshot } from './payload.ts';

	let {
		draft,
		categories,
		foodTypes = [],
		drinkTypes = [],
		user
	}: {
		draft: ReviewDraftSnapshot;
		categories: NestedRatingCategory[];
		foodTypes?: { id: number; name: string }[];
		drinkTypes?: { id: number; name: string }[];
		user?: { displayName: string; avatarUrl: string | null } | null;
	} = $props();

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

	// Third meta segment: the dish's food type, or the drink's drink type — whichever item is
	// in play. "Both" prefers the dish's type, matching how itemName above prefers the dish.
	const itemTypeLabel = $derived.by(() => {
		if (draft.reviewType !== 'beverage') {
			const id = draft.dish.foodTypeIds[0];
			return foodTypes.find((f) => f.id === id)?.name ?? null;
		}
		const id = draft.drink.drinkTypeId;
		return drinkTypes.find((d) => d.id === id)?.name ?? null;
	});

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

	const visibilityLabel: Record<string, string> = {
		public: 'Public',
		friends: 'Friends',
		private: 'Only me'
	};

	const visibilityIcon: Record<string, 'globe' | 'users' | 'lock'> = {
		public: 'globe',
		friends: 'users',
		private: 'lock'
	};

	const authorName = $derived(user?.displayName ?? 'You');
	const authorInitial = $derived(authorName.charAt(0).toUpperCase());
</script>

<article class="overflow-hidden rounded-card border border-line bg-surface shadow-card">
	<header class="flex items-center gap-2.5 px-4 pt-4">
		{#if user?.avatarUrl}
			<img src={user.avatarUrl} alt="" class="h-8 w-8 rounded-full object-cover" />
		{:else}
			<span
				class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent"
			>
				{authorInitial}
			</span>
		{/if}
		<div class="min-w-0">
			<p class="text-sm font-semibold text-ink">{authorName}</p>
			<p class="truncate text-xs text-ink-3">
				{placeLabel} · {visitLabel[draft.visitType]}{#if itemTypeLabel}
					· {itemTypeLabel}{/if}
			</p>
		</div>
	</header>

	<div class="relative mt-3 aspect-16/10 overflow-hidden bg-sunken">
		{#if cover}
			<img src={cover.previewUrl} alt="" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center text-ink-3">
				<Icon name="camera" size={28} />
			</div>
		{/if}
		{#if overallRating !== null}
			<span
				class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-xs font-bold text-ink shadow-card"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="text-accent"
					aria-hidden="true"
				>
					<path d={STAR_PATH} />
				</svg>
				{overallRating.toFixed(1)}
			</span>
		{/if}
		{#if draft.isFavorite}
			<span
				class="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-fav px-2 py-1 text-[11px] font-bold tracking-wide text-white uppercase"
			>
				<Icon name="heart" size={12} />
				Favorite
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
					<span class="rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good"
						>{tag}</span
					>
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

	<footer
		class="mt-3 flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-3"
	>
		<span class="flex items-center gap-1.5">
			<Icon name="calendar" size={14} />
			{formatVisitDate(draft.visitedAt)}
		</span>
		<span class="flex items-center gap-1.5">
			<Icon name={visibilityIcon[draft.visibility]} size={14} />
			{visibilityLabel[draft.visibility]}
		</span>
	</footer>
</article>
