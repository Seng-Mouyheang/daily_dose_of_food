<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import BudgetDialog from './BudgetDialog.svelte';
	import Delta from './Delta.svelte';
	import { money, money0, pct } from './format.ts';
	import type { Period } from './period.ts';
	import type { DashboardSummary } from './summary.ts';

	let {
		spend,
		period,
		hasPrev,
		monthlyBudget
	}: {
		spend: DashboardSummary['spend'];
		period: Period;
		hasPrev: boolean;
		monthlyBudget: number | null;
	} = $props();

	let editing = $state(false);

	/** Less than last period is good (green), more is bad (red), the same stays neutral. */
	const chip = $derived(
		Math.abs(spend.spent - spend.prevSpent) < 0.005
			? 'bg-sunken text-ink-2'
			: spend.spent < spend.prevSpent
				? 'bg-good-soft text-good'
				: 'bg-bad-soft text-bad'
	);
	const over = $derived(spend.budget !== null && spend.spent > spend.budget);
	const used = $derived(spend.budget ? spend.spent / spend.budget : 0);
	const custom = $derived(period.per === 'custom');
	const unit = $derived(
		period.per === 'week' ? 'weekly' : period.per === 'month' ? 'monthly' : 'yearly'
	);
	const prevWhen = $derived(
		`${period.live ? 'by this point ' : ''}${period.per === 'week' ? period.prev.name : `in ${period.prev.name}`}`
	);
</script>

<section
	aria-labelledby="spend-h"
	class="flex h-full flex-col gap-1.5 rounded-card border border-line bg-surface p-5"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="spend-h" class="text-xs font-bold tracking-[.06em] text-ink-2 uppercase">
			Total spent
		</h2>
		{#if hasPrev}
			<span
				class="inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap tabular-nums {chip}"
			>
				<Delta now={spend.spent} prev={spend.prevSpent} format={money} />
				{#if spend.prevSpent && Math.abs(spend.spent - spend.prevSpent) >= 0.005}
					<span aria-hidden="true">·</span>
					<span>{pct(Math.abs(spend.spent - spend.prevSpent), spend.prevSpent)}%</span>
				{/if}
			</span>
		{/if}
	</div>

	<p
		class="font-display text-[40px] leading-tight font-semibold tracking-[-.01em] tabular-nums lg:text-[44px]"
	>
		{money(spend.spent)}
	</p>
	<p class="text-[13.5px] text-ink-2">
		{hasPrev ? `${money(spend.prevSpent)} ${prevWhen}` : 'Your first period on record'}
	</p>

	{#if spend.budget === null}
		<button
			type="button"
			onclick={() => (editing = true)}
			class="mt-3 flex min-h-11 items-center gap-2 self-start rounded-input border border-dashed border-line px-3.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
		>
			<Icon name="plus" size={16} weight={2.2} />Set a monthly budget
		</button>
		<p class="text-[13px] text-ink-3">See how your spending tracks against what you planned.</p>
	{:else}
		<div
			class="relative mt-5 h-2.5 rounded-full bg-track"
			role="img"
			aria-label="{Math.round(used * 100)}% of your {money0(spend.budget)} {custom
				? `budget for ${period.length} days`
				: `${unit} budget`} used"
		>
			<span
				class={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-300 ${over ? 'bg-bad' : 'bg-accent'}`}
				style:width="{Math.min(100, used * 100)}%"
			></span>
			{#if spend.expected !== null}
				<span
					class="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-sm bg-ink transition-[left] duration-300"
					style:left="{(spend.expected / spend.budget) * 100}%"
					title="Where an even pace would put you today ({money0(spend.expected)})"
				>
					<span
						class="absolute bottom-[calc(100%+2px)] left-1/2 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink-2"
						>Today</span
					>
				</span>
			{/if}
		</div>
		<div class="mt-1.5 flex justify-between gap-2.5 text-[13px] text-ink-2">
			<span>
				{#if over}
					<b class="font-semibold text-bad">{money(spend.spent - spend.budget)} over</b>
					{custom ? 'budget' : `your ${unit} budget`}
				{:else if period.live}
					<b class="font-semibold text-ink">{money(spend.budget - spend.spent)} left</b> · {spend.daysLeft}
					day{spend.daysLeft === 1 ? '' : 's'} to go
				{:else}
					<b class="font-semibold text-ink">{money(spend.budget - spend.spent)} under</b> budget
				{/if}
			</span>
			<button
				type="button"
				onclick={() => (editing = true)}
				title={custom && monthlyBudget !== null
					? `Your ${money0(monthlyBudget)} monthly budget, scaled to ${period.length} days`
					: undefined}
				class="min-h-6 font-medium hover:text-ink hover:underline"
				>{money0(spend.budget)} budget{custom ? ` for ${period.length} days` : ''}</button
			>
		</div>
		{#if period.live && spend.daysLeft > 0}
			<p class="mt-1.5 border-t border-line pt-2.5 text-[13.5px] text-ink-2">
				At this pace you'll spend about <b class="font-semibold text-ink">{money0(spend.pace)}</b
				>{spend.pace > spend.budget
					? `, ${money0(spend.pace - spend.budget)} over budget.`
					: ', within budget.'}
			</p>
		{/if}
	{/if}
</section>

<BudgetDialog open={editing} current={monthlyBudget} onclose={() => (editing = false)} />
