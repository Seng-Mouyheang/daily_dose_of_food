<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import Breakdowns from '#lib/dashboard/Breakdowns.svelte';
	import Habits from '#lib/dashboard/Habits.svelte';
	import Highlights from '#lib/dashboard/Highlights.svelte';
	import HowYouRate from '#lib/dashboard/HowYouRate.svelte';
	import KpiTiles from '#lib/dashboard/KpiTiles.svelte';
	import PeriodBar from '#lib/dashboard/PeriodBar.svelte';
	import RecentLogs from '#lib/dashboard/RecentLogs.svelte';
	import Regulars from '#lib/dashboard/Regulars.svelte';
	import SpendCard from '#lib/dashboard/SpendCard.svelte';
	import SpendTrend from '#lib/dashboard/SpendTrend.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.summary);
	// The previous period has data to compare with exactly when stepping back is allowed.
	const hasPrev = $derived(data.canBack);

	// The dashboard scrolls the page itself, so the themed thin scrollbar goes on <html>; taken
	// off again on leaving so other pages keep their own scrollbar.
	$effect(() => {
		const root = document.documentElement;
		root.classList.add('thin-scroll');
		return () => root.classList.remove('thin-scroll');
	});
</script>

<svelte:head><title>Dashboard · Daily Dose of Food</title></svelte:head>

<main
	class="mx-auto flex max-w-[1120px] flex-col gap-3.5 px-3.5 pt-4 pb-7 lg:grid lg:grid-cols-12 lg:gap-[18px] lg:px-7 lg:pt-7 lg:pb-12"
>
	<header class="flex flex-col gap-3 lg:col-span-12 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<h1 class="font-display text-[26px] font-semibold tracking-[-.01em] lg:text-[28px]">
				Dashboard
			</h1>
			<p class="mt-1 hidden text-[14.5px] text-ink-2 lg:block">
				Your spending, ratings and habits, from what you log.
			</p>
		</div>
		{#if data.hasLogs}
			<PeriodBar
				period={data.period}
				canBack={data.canBack}
				canForward={data.canForward}
				today={data.today}
				firstLog={data.firstLog!}
			/>
		{/if}
	</header>

	{#if !data.hasLogs}
		<section
			class="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-7 py-11 text-center lg:col-span-12"
		>
			<span
				class="mb-1 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-strong"
			>
				<Icon name="chart" size={24} />
			</span>
			<h2 class="font-display text-lg font-semibold">Nothing to chart yet</h2>
			<p class="max-w-[34ch] text-sm text-ink-2">
				Every review you publish shows up here: what you spent, where, and how it rated.
			</p>
			<a
				href="/review/new"
				class="mt-2 inline-flex h-11 items-center gap-1.5 rounded-input bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-90"
			>
				<Icon name="plus" size={16} weight={2.4} />Write your first review
			</a>
		</section>
	{:else}
		<div class="lg:col-span-5">
			<SpendCard
				spend={s.spend}
				period={data.period}
				{hasPrev}
				monthlyBudget={data.monthlyBudget}
			/>
		</div>
		<div class="lg:col-span-7"><KpiTiles kpis={s.kpis} period={data.period} {hasPrev} /></div>
		<div class="lg:col-span-8"><SpendTrend trend={s.trend} period={data.period} /></div>
		<div class="lg:col-span-4"><Breakdowns where={s.where} spent={s.spend.spent} /></div>
		{#if s.highlights}
			<div class="lg:col-span-4"><Highlights highlights={s.highlights} /></div>
		{/if}
		<div class={s.highlights ? 'lg:col-span-4' : 'lg:col-span-6'}>
			<Regulars regulars={s.regulars} />
		</div>
		<div class={s.highlights ? 'lg:col-span-4' : 'lg:col-span-6'}>
			<HowYouRate ratings={s.ratings} />
		</div>
		<div class="lg:col-span-4"><Habits habits={s.habits} meals={s.kpis.meals.now} /></div>
		<div class="lg:col-span-8"><RecentLogs recent={s.recent} /></div>
	{/if}
</main>
