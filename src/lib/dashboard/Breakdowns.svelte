<script lang="ts">
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
	<div class="flex gap-1 rounded-input bg-sunken p-[3px]" role="group" aria-label="Group by">
		{#each DIMS as d (d.value)}
			<button
				type="button"
				aria-pressed={dim === d.value}
				onclick={() => (dim = d.value)}
				class={`min-h-9 flex-1 rounded-[9px] text-[13px] font-semibold transition-colors ${
					dim === d.value
						? 'bg-surface text-accent-strong shadow-card'
						: 'text-ink-2 hover:text-ink'
				}`}>{d.label}</button
			>
		{/each}
	</div>
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
