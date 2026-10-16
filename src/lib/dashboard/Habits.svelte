<script lang="ts">
	import HBars from './HBars.svelte';
	import { pct } from './format.ts';
	import type { DashboardSummary } from './summary.ts';

	let { habits, meals }: { habits: DashboardSummary['habits']; meals: number } = $props();

	const asRows = (bars: { name: string; value: number }[]) =>
		bars.map((b) => ({ name: b.name, value: b.value, text: `${pct(b.value, meals)}%` }));
</script>

<section
	aria-labelledby="hab-h"
	class="flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-5"
>
	<h2 id="hab-h" class="font-display text-[17px] font-semibold">Your habits</h2>
	{#if meals}
		<div class="flex flex-col gap-2">
			<h3 class="text-[13px] font-semibold text-ink-2">When you eat</h3>
			<HBars label="Share of meals by time of day" rows={asRows(habits.meals)} max={meals} />
		</div>
		<div class="flex flex-col gap-2">
			<h3 class="text-[13px] font-semibold text-ink-2">How you eat</h3>
			<HBars
				label="Share of meals by dine-in, takeaway or delivery"
				rows={asRows(habits.visits)}
				max={meals}
			/>
		</div>
		{#if habits.busiestDay}
			<p class="text-[13px] text-ink-3">
				You eat out most on <b class="font-semibold text-ink-2">{habits.busiestDay}s</b>.
			</p>
		{/if}
	{:else}
		<p class="text-[13px] text-ink-3">Nothing logged in this period yet.</p>
	{/if}
</section>
