<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { money } from '#lib/dashboard/format.ts';
	import { MONTHS } from '#lib/dashboard/period.ts';
	import StreakLine from './StreakLine.svelte';
	import type { monthSummary } from './day.ts';

	/** Desktop's month card under the calendar. "So far" while the month is still running. */
	let {
		summary,
		month,
		today,
		streak,
		loggedToday
	}: {
		summary: ReturnType<typeof monthSummary>;
		month: string;
		today: string;
		streak: number;
		loggedToday: boolean;
	} = $props();

	const name = $derived(MONTHS[Number(month.slice(5)) - 1]);
	const running = $derived(month === today.slice(0, 7));
</script>

<section
	aria-labelledby="month-h"
	class="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="month-h" class="font-display text-[17px] font-semibold">
			{name}{running ? ' so far' : ''}
		</h2>
		<a
			href="/dashboard"
			class="inline-flex min-h-11 items-center gap-1 px-1.5 text-sm font-semibold text-accent-strong hover:underline"
			>Dashboard<Icon name="chevR" size={16} weight={2.4} /></a
		>
	</div>
	<dl class="grid grid-cols-2 gap-x-2 gap-y-4">
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Spent</dt>
			<dd class="font-display text-[22px] font-semibold tabular-nums">{money(summary.spent)}</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Visits</dt>
			<dd class="font-display text-[22px] font-semibold tabular-nums">{summary.visits}</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Days logged</dt>
			<dd class="flex items-end gap-1 font-display text-[22px] font-semibold tabular-nums">
				{summary.daysLogged}
				<span class="pb-1 font-sans text-sm font-medium text-ink-3">of {summary.daysElapsed}</span>
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Most visited</dt>
			<dd class="truncate pt-1.5 text-[15px] font-semibold">{summary.mostVisited ?? '–'}</dd>
		</div>
	</dl>
	<StreakLine {streak} {loggedToday} />
</section>
