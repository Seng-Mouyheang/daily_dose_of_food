<script lang="ts">
	import HBars from './HBars.svelte';
	import type { DashboardSummary } from './summary.ts';

	let { ratings }: { ratings: DashboardSummary['ratings'] } = $props();

	const NAMES = {
		food: 'Food & drink',
		value: 'Value for money',
		service: 'Service',
		hygiene: 'Hygiene'
	};
	const rows = $derived(
		ratings.scores.flatMap((s) =>
			s.value === null ? [] : [{ name: NAMES[s.key], value: s.value, text: s.value.toFixed(1) }]
		)
	);
</script>

<section
	aria-labelledby="rate-h"
	class="flex h-full flex-col gap-3.5 rounded-card border border-line bg-surface p-5"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="rate-h" class="font-display text-[17px] font-semibold">How you rate</h2>
		<span class="text-[12.5px] text-ink-3">Average out of 5</span>
	</div>
	{#if rows.length}
		<HBars label="Average sub-scores" {rows} max={5} />
		{#if ratings.toughest}
			<p class="text-[13px] text-ink-3">
				You're toughest on <b class="font-semibold text-ink-2"
					>{NAMES[ratings.toughest].toLowerCase()}</b
				>.
			</p>
		{/if}
	{:else}
		<p class="text-[13px] text-ink-3">Rate a few visits to see your averages here.</p>
	{/if}
</section>
