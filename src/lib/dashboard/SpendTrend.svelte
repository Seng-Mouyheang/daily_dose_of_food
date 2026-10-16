<script lang="ts">
	import { money, money0 } from './format.ts';
	import type { Period } from './period.ts';
	import type { DashboardSummary } from './summary.ts';

	let { trend, period }: { trend: DashboardSummary['trend']; period: Period } = $props();

	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const unit = $derived(trend.grain);
	const dense = $derived(trend.buckets.length > 20);
	/** Custom ranges and long periods label every nth bar so ticks don't crowd. */
	const every = $derived(
		period.per === 'custom' && trend.buckets.length > 7 ? Math.ceil(trend.buckets.length / 6) : 1
	);
	const dayShort = (d: Date) =>
		d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

	/** Full name for the tooltip and peak line, short tick for the axis (blank when skipped). */
	function names(key: string, i: number): { full: string; tick: string } {
		const show = i % every === 0;
		if (unit === 'month') {
			const m = Number(key.slice(5, 7)) - 1;
			const tick = period.per === 'year' ? MONTHS[m]![0]! : MONTHS[m]!;
			return { full: `${MONTHS[m]} ${key.slice(0, 4)}`, tick: show ? tick : '' };
		}
		const d = new Date(`${key}T00:00:00Z`);
		if (unit === 'week') {
			const days = Math.min(7, period.length - i * 7);
			return {
				full: `week of ${dayShort(d)}${days < 7 ? ` (${days} day${days === 1 ? '' : 's'})` : ''}`,
				tick: show ? dayShort(d) : ''
			};
		}
		const full = d.toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});
		const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
		if (period.per === 'week') return { full, tick: weekday };
		if (period.per === 'custom')
			return { full, tick: trend.buckets.length <= 7 ? weekday : show ? dayShort(d) : '' };
		const day = d.getUTCDate();
		return { full, tick: [1, 8, 15, 22, 29].includes(day) ? String(day) : '' };
	}
	const peakIndex = $derived(trend.peak ? trend.buckets.indexOf(trend.peak) : -1);
	const h = (v: number) => `${(v / trend.top) * 100}%`;
	const meals = (n: number) => `${n} meal${n === 1 ? '' : 's'}`;
</script>

<section
	aria-labelledby="trend-h"
	class="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="trend-h" class="font-display text-[17px] font-semibold">Spending by {unit}</h2>
		<span class="text-[12.5px] text-ink-3">Avg {money(trend.avg)} a {unit}</span>
	</div>

	<div class="relative mt-3">
		{#each [1, 0.5] as f (f)}
			<span
				class="absolute inset-x-0 border-t border-dashed border-line"
				style:bottom="{f * 100}%"
				aria-hidden="true"
			>
				<em
					class="absolute right-0 bottom-0.5 bg-surface pl-1 text-[11px] text-ink-3 not-italic tabular-nums"
					>{money0(trend.top * f)}</em
				>
			</span>
		{/each}
		<div
			class={`relative flex h-[120px] items-end border-b border-line pr-10 lg:h-[170px] ${dense ? 'gap-0.5' : 'gap-1.5'}`}
			role="group"
			aria-label="Spending by {unit}. {trend.peak
				? `Highest: ${names(trend.peak.key, peakIndex).full}, ${money(trend.peak.value)}.`
				: 'Nothing logged yet.'}"
		>
			{#each trend.buckets as b, i (b.key)}
				{@const n = names(b.key, i)}
				{#if b.future}
					<span class="h-full min-w-0 flex-1" aria-hidden="true"></span>
				{:else}
					<button
						type="button"
						class="group relative flex h-full min-w-0 flex-1 cursor-default items-end"
						aria-label="{n.full}: {money(b.value)}, {meals(b.count)}"
					>
						<span
							class="block w-full origin-bottom animate-grow-y rounded-t bg-accent transition-[height,background-color] duration-300 group-hover:bg-accent-strong group-focus-visible:bg-accent-strong"
							style:height={h(b.value)}
						></span>
						<span
							class={`pointer-events-none absolute z-10 hidden rounded-lg bg-ink px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-bg shadow-card group-hover:block group-focus-visible:block ${
								i < 3
									? 'left-0'
									: i > trend.buckets.length - 4
										? 'right-0'
										: 'left-1/2 -translate-x-1/2'
							}`}
							style:bottom="calc({h(b.value)} + 8px)"
							aria-hidden="true"
						>
							<b class="block text-[13.5px]">{money(b.value)}</b><span
								class="inline-block first-letter:uppercase">{n.full}</span
							>
							· {meals(b.count)}
						</span>
					</button>
				{/if}
			{/each}
			<span
				class="pointer-events-none absolute inset-x-0 z-[1] border-t-[1.5px] border-dashed border-ink-3 transition-[bottom] duration-300"
				style:bottom={h(trend.avg)}
				aria-hidden="true"
				><em class="absolute top-0.5 right-0 text-[11px] font-semibold text-ink-2 not-italic"
					>avg</em
				></span
			>
		</div>
	</div>
	<div class={`-mt-1.5 flex pr-10 ${dense ? 'gap-0.5' : 'gap-1.5'}`} aria-hidden="true">
		{#each trend.buckets as b, i (b.key)}
			<span class="min-w-0 flex-1 text-center text-[11px] whitespace-nowrap text-ink-3"
				>{names(b.key, i).tick}</span
			>
		{/each}
	</div>
	{#if trend.peak}
		<p class="text-[13px] text-ink-3">
			Your biggest {unit} was
			<b class="font-semibold text-ink-2">{names(trend.peak.key, peakIndex).full}</b>
			at {money(trend.peak.value)}.
		</p>
	{/if}
</section>
