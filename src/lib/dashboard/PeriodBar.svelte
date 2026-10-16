<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { dashboardHref, type Per, type Period } from './period.ts';

	/** Week / Month / Year plus a ‹ October 2026 › stepper. Links, not buttons, so the period
	 *  lives in the URL and survives a reload or a shared link. */
	let { period, canBack, canForward }: { period: Period; canBack: boolean; canForward: boolean } =
		$props();

	const PERIODS: { value: Per; label: string }[] = [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' }
	];
</script>

<div class="flex flex-col gap-2 lg:flex-row-reverse lg:items-center lg:gap-2.5">
	<nav class="flex gap-1 rounded-input bg-sunken p-1 lg:w-64" aria-label="Period">
		{#each PERIODS as p (p.value)}
			{@const selected = period.per === p.value}
			<a
				href={dashboardHref({ per: p.value, off: 0 })}
				aria-current={selected ? 'page' : undefined}
				class={`flex min-h-10 flex-1 items-center justify-center rounded-[10px] px-3 text-sm font-semibold transition-colors ${
					selected ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-2 hover:text-ink'
				}`}>{p.label}</a
			>
		{/each}
	</nav>

	<div
		class="flex items-center justify-between gap-1.5 rounded-input border border-line bg-surface p-0.5 lg:min-w-64"
	>
		<IconButton
			icon="chevL"
			label="Previous {period.per}"
			href={dashboardHref({ per: period.per, off: period.off - 1 })}
			inert={!canBack}
			class={canBack ? '' : 'opacity-30'}
		/>
		<span class="flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
			<Icon name="calendar" size={16} />
			<b class="font-semibold text-ink tabular-nums">{period.label}</b>
			{#if period.live}
				<span
					class="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent-strong"
					>So far</span
				>
			{/if}
		</span>
		<IconButton
			icon="chevR"
			label="Next {period.per}"
			href={dashboardHref({ per: period.per, off: period.off + 1 })}
			inert={!canForward}
			class={canForward ? '' : 'opacity-30'}
		/>
	</div>
</div>
