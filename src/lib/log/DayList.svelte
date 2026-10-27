<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { money } from '#lib/dashboard/format.ts';
	import { MEAL_LABEL, VISIT_LABEL } from '#lib/review/card.ts';
	import { MEALS, visitTitle, type MealType, type Visit } from './visits.ts';

	/** "What you had": the day's visits under Breakfast, Lunch, Dinner and Snack, with a quiet
	 *  dashed row to add each meal that's still empty. A review is a link to its page; any other
	 *  visit opens through `onopen`. Without `onadd` / `onopen` the controls render but stay off,
	 *  as DESIGN.md does for features whose pieces haven't landed. */
	let {
		visits,
		isToday,
		flash = null,
		onadd,
		onopen
	}: {
		visits: Visit[];
		isToday: boolean;
		/** Key of a visit just saved: it pulses once so you can see where it landed. */
		flash?: string | null;
		onadd?: (meal?: MealType) => void;
		onopen?: (key: string) => void;
	} = $props();

	const sum = (vs: Visit[]) => vs.reduce((t, v) => t + v.price, 0);
	const rowClass = '-mx-2 flex min-h-[58px] items-center gap-3 rounded-input px-2 py-1.5 text-left';
	const flashClass = (v: Visit) => (v.key === flash ? 'new-visit' : '');
</script>

{#snippet add(meal: MealType, label: string)}
	<button
		type="button"
		disabled={!onadd}
		onclick={() => onadd?.(meal)}
		class="-mx-2 flex min-h-11 items-center gap-3 rounded-input px-2 text-left text-[13.5px] font-medium text-ink-3 enabled:hover:bg-sunken enabled:hover:text-ink-2"
	>
		<span class="grid w-10 flex-none place-items-center">
			<span
				class="border-line-2 grid h-7 w-7 place-items-center rounded-[9px] border border-dashed"
			>
				<Icon name="plus" size={15} weight={2} />
			</span>
		</span>
		{label}
	</button>
{/snippet}

{#snippet visit(v: Visit)}
	<span class="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-sunken text-ink-3">
		<Icon name={v.drink ? 'coffee' : 'plate'} size={20} weight={1.6} />
	</span>
	<span class="flex min-w-0 flex-1 flex-col">
		<b class="truncate text-[14.5px] font-semibold">{visitTitle(v.items)}</b>
		<small class="truncate text-[12.5px] text-ink-3">
			{v.place} · {VISIT_LABEL[v.dining]}{#if v.reviewId}
				· <em class="font-medium text-accent-strong not-italic">Review</em>{/if}
		</small>
	</span>
	<span class="flex flex-col items-end font-semibold tabular-nums">
		{money(v.price)}
		<small
			class="flex items-center gap-0.5 text-xs text-ink-2"
			aria-label="{v.overall.toFixed(1)} stars"
		>
			<svg
				width="11"
				height="11"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="text-accent"
				aria-hidden="true"><path d={STAR_PATH} /></svg
			>{v.overall.toFixed(1)}
		</small>
	</span>
{/snippet}

<section class="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
	<h2 class="font-display text-[17px] font-semibold">What you had</h2>

	{#if visits.length === 0}
		<div class="flex flex-col items-center gap-2 px-3 pt-5 pb-3 text-center">
			<span
				class="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-strong"
			>
				<Icon name="plate" size={24} />
			</span>
			<h3 class="font-display text-lg font-semibold">
				Nothing logged {isToday ? 'yet today' : 'on this day'}
			</h3>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Add where you went and what you had. It only takes a few taps.
			</p>
			<button
				type="button"
				disabled={!onadd}
				onclick={() => onadd?.()}
				class="mt-1 inline-flex h-11 items-center gap-1.5 rounded-input bg-accent px-4 text-sm font-bold text-on-accent enabled:hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Icon name="plus" size={16} weight={2.4} />Log a visit
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-3.5">
			{#each MEALS as meal (meal)}
				{@const list = visits.filter((v) => v.meal === meal)}
				{#if list.length === 0}
					{#if meal === 'snack'}
						{@render add(meal, 'Add a snack or drink')}
					{:else}
						{@render add(meal, `Add ${MEAL_LABEL[meal]!.toLowerCase()}`)}
					{/if}
				{:else}
					<div class="flex flex-col gap-0.5">
						<div
							class="flex items-baseline justify-between pb-0.5 text-[13px] font-semibold text-ink-2"
						>
							{meal === 'snack' ? 'Snacks & drinks' : MEAL_LABEL[meal]}
							<span class="font-medium text-ink-3 tabular-nums">{money(sum(list))}</span>
						</div>
						{#each list as v (v.key)}
							{#if v.reviewId}
								<a href="/review/{v.reviewId}" class="{rowClass} hover:bg-sunken {flashClass(v)}"
									>{@render visit(v)}</a
								>
							{:else if onopen}
								<button
									type="button"
									onclick={() => onopen(v.key)}
									class="{rowClass} hover:bg-sunken {flashClass(v)}">{@render visit(v)}</button
								>
							{:else}
								<div class="{rowClass} {flashClass(v)}">{@render visit(v)}</div>
							{/if}
						{/each}
						{#if meal === 'snack'}{@render add(meal, 'Add another snack or drink')}{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</section>

<style>
	.new-visit {
		animation: new-visit 2.4s ease;
	}
	@keyframes new-visit {
		0%,
		45% {
			background: var(--accent-soft);
		}
	}
</style>
