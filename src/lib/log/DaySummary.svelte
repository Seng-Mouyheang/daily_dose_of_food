<script lang="ts">
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { money } from '#lib/dashboard/format.ts';
	import StreakLine from './StreakLine.svelte';
	import type { daySummary } from './day.ts';

	/** What the day cost against its share of the monthly budget (monthly × 12 ÷ 365). The meter
	 *  turns `bad` only when the day goes over; with no budget set it points at the dashboard
	 *  instead. The streak shows on mobile, where there is no month card to hold it. */
	let {
		summary,
		dailyBudget,
		streak,
		loggedToday,
		showStreak
	}: {
		summary: ReturnType<typeof daySummary>;
		dailyBudget: number | null;
		streak: number;
		loggedToday: boolean;
		showStreak: boolean;
	} = $props();

	const over = $derived(dailyBudget !== null && summary.spent > dailyBudget);
</script>

<section
	aria-label="Day summary"
	class="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4"
>
	<dl class="grid grid-cols-3 gap-2">
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Spent</dt>
			<dd class="font-display text-[22px] font-semibold tabular-nums">{money(summary.spent)}</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Visits</dt>
			<dd class="font-display text-[22px] font-semibold tabular-nums">{summary.visits}</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-0.5">
			<dt class="text-[12.5px] font-medium text-ink-2">Avg rating</dt>
			<dd class="flex items-center gap-1 font-display text-[22px] font-semibold tabular-nums">
				{#if summary.rating !== null}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="text-accent"
						aria-hidden="true"><path d={STAR_PATH} /></svg
					>{summary.rating.toFixed(1)}
				{:else}
					–
				{/if}
			</dd>
		</div>
	</dl>

	{#if dailyBudget !== null}
		<div>
			<div
				class="h-2 rounded-full bg-track"
				role="img"
				aria-label="{money(summary.spent)} of a {money(dailyBudget)} daily budget"
			>
				<span
					class="block h-full rounded-full transition-[width] duration-300 {over
						? 'bg-bad'
						: 'bg-accent'}"
					style:width="{Math.min(100, (summary.spent / dailyBudget) * 100)}%"
				></span>
			</div>
			<p class="mt-2 text-[13px] text-ink-2">
				{#if over}
					<b class="font-semibold text-bad">{money(summary.spent - dailyBudget)} over</b> your daily budget
				{:else}
					<b class="font-semibold text-ink">{money(dailyBudget - summary.spent)} left</b> of {money(
						dailyBudget
					)} a day
				{/if}
			</p>
		</div>
	{:else}
		<p class="text-[13px] text-ink-2">
			<a href="/dashboard" class="font-semibold text-accent-strong hover:underline"
				>Set a monthly budget</a
			> on the dashboard to see how each day compares.
		</p>
	{/if}

	{#if showStreak}<StreakLine {streak} {loggedToday} />{/if}
</section>
