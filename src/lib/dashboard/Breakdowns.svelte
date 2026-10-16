<script lang="ts">
	import SegmentedControl from '#lib/components/SegmentedControl.svelte';
	import HBars from './HBars.svelte';
	import { money, pct } from './format.ts';
	import type { DashboardSummary, Dim } from './summary.ts';

	/** "Where it went": all three groupings arrive with the page, so switching is instant. */
	let { where, spent }: { where: DashboardSummary['where']; spent: number } = $props();

	let dim = $state<Dim>('kind');
	const DIMS: { value: Dim; label: string }[] = [
		{ value: 'kind', label: 'Type' },
		{ value: 'cuisine', label: 'Cuisine' },
		{ value: 'meal', label: 'Meal' }
	];
</script>

<section
	aria-labelledby="where-h"
	class="flex h-full flex-col gap-3.5 rounded-card border border-line bg-surface p-5"
>
	<h2 id="where-h" class="font-display text-[17px] font-semibold">Where it went</h2>
	<SegmentedControl options={DIMS} bind:value={dim} groupLabel="Group by" />
	{#if where[dim].length}
		<HBars
			label="Spending by {DIMS.find((d) => d.value === dim)!.label.toLowerCase()}"
			rows={where[dim].map((b) => ({
				name: b.name,
				value: b.value,
				text: money(b.value),
				pct: pct(b.value, spent)
			}))}
		/>
	{:else}
		<p class="text-[13px] text-ink-3">Nothing logged in this period yet.</p>
	{/if}
</section>
