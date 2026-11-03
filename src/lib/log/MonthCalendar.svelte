<script lang="ts">
	import IconButton from '#lib/components/IconButton.svelte';
	import { MONTHS, monthGrid } from '#lib/dashboard/period.ts';
	import { dayLabel, logHref, shiftMonth } from './day.ts';

	/** A month of days, Monday first. The desktop page keeps it on screen; on mobile it fills the
	 *  month sheet. Arrows browse months without changing the day on screen (`?month=`); a day is a
	 *  link; `onpick` hears a tap on one, even on the day already open. */
	let {
		month,
		day,
		today,
		first,
		counts,
		onpick
	}: {
		month: string;
		day: string;
		today: string;
		first: string;
		counts: Record<string, number>;
		onpick?: () => void;
	} = $props();

	const grid = $derived(monthGrid(month));
	const prev = $derived(month > first.slice(0, 7) ? shiftMonth(month, -1) : null);
	const next = $derived(month < today.slice(0, 7) ? shiftMonth(month, 1) : null);
	const title = $derived(`${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);

	const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
</script>

<div class="flex flex-col gap-2.5">
	<div class="flex items-center justify-between">
		<IconButton
			icon="chevL"
			label="Previous month"
			size={18}
			href={prev ? logHref(day, today, prev) : undefined}
			inert={!prev}
			class={prev ? '' : 'opacity-30'}
		/>
		<b class="text-[15px] font-semibold" aria-live="polite">{title}</b>
		<IconButton
			icon="chevR"
			label="Next month"
			size={18}
			href={next ? logHref(day, today, next) : undefined}
			inert={!next}
			class={next ? '' : 'opacity-30'}
		/>
	</div>

	<div class="grid grid-cols-7 gap-y-0.5">
		{#each WEEK as w (w)}
			<small class="pt-1 pb-1.5 text-center text-xs font-semibold text-ink-3">{w}</small>
		{/each}
		{#each grid.days as d (d)}
			{@const off = d > today || d < first}
			{@const n = counts[d] ?? 0}
			{@const selected = d === day}
			{@const cell = 'group grid h-11 place-items-center text-sm font-medium tabular-nums'}
			{@const start = d === grid.days[0] ? grid.lead + 1 : undefined}
			{#if off}
				<span
					aria-disabled="true"
					aria-label={dayLabel(d, today)}
					style:grid-column-start={start}
					class="{cell} opacity-45"
				>
					{@render num(d, n, selected, off)}
				</span>
			{:else}
				<a
					href={logHref(d, today, month)}
					onclick={onpick}
					aria-current={selected ? 'date' : undefined}
					aria-label="{dayLabel(d, today)}, {n} {n === 1 ? 'log' : 'logs'}"
					data-sveltekit-reset="false"
					style:grid-column-start={start}
					class={cell}
				>
					{@render num(d, n, selected, off)}
				</a>
			{/if}
		{/each}
	</div>

	<div class="flex items-center gap-4 text-[12.5px] text-ink-3">
		<span class="inline-flex items-center gap-1.5"
			><i class="h-3 w-3 rounded-full bg-accent-soft"></i>Logged</span
		>
		<span class="inline-flex items-center gap-1.5"
			><i class="h-3 w-3 rounded-full ring-[1.5px] ring-accent ring-inset"></i>Today</span
		>
	</div>
</div>

{#snippet num(d: string, n: number, selected: boolean, off: boolean)}
	<span
		class="grid h-[38px] w-[38px] place-items-center rounded-full transition-colors {selected
			? 'bg-accent font-bold text-on-accent'
			: n
				? 'bg-accent-soft text-accent-strong'
				: ''} {d === today && !selected ? 'ring-[1.5px] ring-accent ring-inset' : ''} {off ||
		selected
			? ''
			: 'group-hover:bg-sunken'}">{Number(d.slice(8))}</span
	>
{/snippet}
