<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { preloadData } from '$app/navigation';
	import DateRangePicker from './DateRangePicker.svelte';
	import { dashboardHref, type Per, type Period } from './period.ts';

	/** Week / Month / Year plus a ‹ October 2026 › stepper. Links, not buttons, so the period
	 *  lives in the URL and survives a reload or a shared link. */
	let {
		period,
		canBack,
		canForward,
		today,
		firstLog
	}: {
		period: Period;
		canBack: boolean;
		canForward: boolean;
		today: string;
		firstLog: string;
	} = $props();

	let picking = $state(false);
	let controls = $state<HTMLElement>();
	const custom = $derived(period.per === 'custom');
	const step = $derived(custom ? `${period.length} days` : period.per);
	const at = (off: number) =>
		dashboardHref({ per: period.per, off, from: period.from, to: period.to });

	const PERIODS: { value: Per; label: string }[] = [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' },
		{ value: 'custom', label: 'Custom' }
	];

	// Fetch the other two periods in the background as soon as this one shows, so switching is
	// near-instant (hover preloading alone doesn't help on touch screens). SvelteKit reuses the
	// preloaded data when the link is clicked.
	$effect(() => {
		for (const p of PERIODS)
			if (p.value !== period.per && p.value !== 'custom')
				void preloadData(dashboardHref({ per: p.value, off: 0 }));
	});
</script>

<div
	bind:this={controls}
	class="flex flex-col gap-2 lg:flex-row-reverse lg:items-stretch lg:gap-2.5"
>
	<nav
		class="relative grid grid-cols-4 rounded-input bg-sunken p-1 lg:w-[330px]"
		aria-label="Period"
	>
		<!-- One highlight that slides to the selected period, so the switch reads as a move. -->
		<span
			class="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-[10px] bg-surface transition-transform duration-300 ease-out"
			style:transform="translateX({PERIODS.findIndex((p) => p.value === period.per) * 100}%)"
			aria-hidden="true"
		></span>
		{#each PERIODS as p (p.value)}
			{@const selected = period.per === p.value}
			{@const cls = `relative flex min-h-10 items-center justify-center rounded-[10px] px-2 text-sm font-semibold transition-colors ${
				selected ? 'text-accent-strong' : 'text-ink-2 hover:text-ink'
			}`}
			{#if p.value === 'custom'}
				<button
					type="button"
					aria-haspopup="dialog"
					aria-current={selected ? 'page' : undefined}
					class={cls}
					onclick={() => (picking = true)}>{p.label}</button
				>
			{:else}
				<a
					href={dashboardHref({ per: p.value, off: 0 })}
					aria-current={selected ? 'page' : undefined}
					class={cls}>{p.label}</a
				>
			{/if}
		{/each}
	</nav>

	<div
		class="flex items-center justify-between gap-1.5 rounded-input border border-line bg-surface p-0.5 lg:min-w-64"
	>
		<IconButton
			icon="chevL"
			label="Previous {step}"
			href={at(period.off - 1)}
			inert={!canBack}
			class={canBack ? '' : 'opacity-30'}
		/>
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label="{period.label}. Pick dates"
			onclick={() => (picking = true)}
			class="flex min-w-0 items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-sm text-ink-2 hover:bg-sunken"
			aria-live="polite"
		>
			<Icon name="calendar" size={16} />
			<b class="font-semibold whitespace-nowrap text-ink tabular-nums">{period.label}</b>
			{#if period.live}
				<span
					class="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent-strong"
					>So far</span
				>
			{/if}
			{#if custom}
				<span
					class="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-ink-2"
					>{period.length} days</span
				>
			{/if}
		</button>
		<IconButton
			icon="chevR"
			label="Next {step}"
			href={at(period.off + 1)}
			inert={!canForward}
			class={canForward ? '' : 'opacity-30'}
		/>
	</div>
</div>

<DateRangePicker
	open={picking}
	start={period.start}
	end={period.end}
	{today}
	{firstLog}
	anchor={controls}
	onclose={() => (picking = false)}
/>
