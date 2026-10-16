<script lang="ts">
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import Delta from './Delta.svelte';
	import { money } from './format.ts';
	import type { Period } from './period.ts';
	import type { DashboardSummary } from './summary.ts';

	let {
		kpis,
		period,
		hasPrev
	}: { kpis: DashboardSummary['kpis']; period: Period; hasPrev: boolean } = $props();

	const vs = $derived(
		period.per === 'week'
			? period.off === 0
				? 'last wk'
				: 'wk before'
			: period.per === 'month'
				? period.prev.name.slice(0, 3)
				: period.prev.name
	);
</script>

{#snippet tile(
	label: string,
	value: string,
	star: boolean,
	delta: import('svelte').Snippet | null,
	sub = ''
)}
	<div
		class="flex min-w-0 flex-col justify-center gap-0.5 rounded-tile border border-line bg-surface px-3.5 py-3 lg:px-4.5"
	>
		<small class="text-[12.5px] font-medium text-ink-2">{label}</small>
		<b
			class="flex items-center gap-1 font-display text-2xl font-semibold tabular-nums lg:text-[28px]"
		>
			{#if star}<svg
					width="17"
					height="17"
					viewBox="0 0 24 24"
					class="text-accent"
					fill="currentColor"
					aria-hidden="true"><path d={STAR_PATH} /></svg
				>{/if}{value}
		</b>
		<span class="truncate text-xs text-ink-3"
			>{#if delta}{@render delta()}{:else}{sub}&nbsp;{/if}</span
		>
	</div>
{/snippet}

{#snippet meals()}<Delta
		now={kpis.meals.now}
		prev={kpis.meals.prev}
		format={String}
		unit={1}
		{vs}
	/>{/snippet}
{#snippet avgPrice()}<Delta
		now={kpis.avgPrice.now ?? 0}
		prev={kpis.avgPrice.prev ?? 0}
		format={money}
		{vs}
	/>{/snippet}
{#snippet avgRating()}<Delta
		now={kpis.avgRating.now ?? 0}
		prev={kpis.avgRating.prev ?? 0}
		format={(n) => n.toFixed(1)}
		unit={0.05}
		{vs}
	/>{/snippet}

<div class="grid h-full grid-cols-2 gap-2.5 lg:grid-rows-2">
	{@render tile('Meals logged', String(kpis.meals.now), false, hasPrev ? meals : null)}
	{@render tile(
		'Avg per meal',
		kpis.avgPrice.now === null ? '—' : money(kpis.avgPrice.now),
		false,
		hasPrev && kpis.avgPrice.now !== null && kpis.avgPrice.prev !== null ? avgPrice : null
	)}
	{@render tile(
		'Avg rating',
		kpis.avgRating.now === null ? '—' : kpis.avgRating.now.toFixed(1),
		kpis.avgRating.now !== null,
		hasPrev && kpis.avgRating.now !== null && kpis.avgRating.prev !== null ? avgRating : null
	)}
	{@render tile(
		'New places',
		String(kpis.newPlaces),
		false,
		null,
		`${kpis.placeCount} place${kpis.placeCount === 1 ? '' : 's'} in total`
	)}
</div>
