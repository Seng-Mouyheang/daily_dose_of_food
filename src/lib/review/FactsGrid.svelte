<script lang="ts">
	import { MEAL_LABEL, VISIT_LABEL, totalWithTax, type FeedReview } from './card.ts';
	import { formatVisitDate } from './format.ts';

	let { review }: { review: FeedReview } = $props();

	const total = $derived(totalWithTax(review.items));

	// Meal type is null on a drink-only review (the schema allows it precisely for that), so
	// that slot shows what was ordered instead of an empty "Meal —".
	const facts = $derived([
		['Visited', formatVisitDate(review.visitedAt.slice(0, 10))],
		['How', VISIT_LABEL[review.visitType] ?? review.visitType],
		review.mealType
			? ['Meal', MEAL_LABEL[review.mealType] ?? review.mealType]
			: ['Type', review.items[0]?.typeLabel ?? 'Drink'],
		['Total paid', total === null ? 'Not recorded' : `$${total.toFixed(2)}`]
	] as [string, string][]);
</script>

<dl class="grid grid-cols-2 gap-px overflow-hidden rounded-tile border border-line bg-line">
	{#each facts as [label, value] (label)}
		<div class="bg-surface px-3.5 py-2.5">
			<dt class="text-xs font-semibold text-ink-3">{label}</dt>
			<dd class="text-[14.5px] font-semibold text-ink">{value}</dd>
		</div>
	{/each}
</dl>
