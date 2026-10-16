<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { money, shortDate } from './format.ts';
	import { logPrice, type DashboardSummary, type DashLog } from './summary.ts';

	let { highlights }: { highlights: NonNullable<DashboardSummary['highlights']> } = $props();
</script>

{#snippet star(size: number)}<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"><path d={STAR_PATH} /></svg
	>{/snippet}

{#snippet row(kind: 'top' | 'value' | 'splurge', label: string, l: DashLog)}
	<li>
		<a
			href="/review/{l.id}"
			class="flex min-h-11 items-center gap-3 rounded-input px-2 py-2 text-ink-3 hover:bg-sunken"
		>
			<span
				class="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-accent-soft text-accent-strong"
			>
				{#if kind === 'top'}{@render star(18)}{:else}<Icon
						name={kind === 'value' ? 'tag' : 'sparkle'}
						size={18}
					/>{/if}
			</span>
			<span class="flex min-w-0 flex-1 flex-col">
				<small class="text-[12px] font-semibold text-ink-3">{label}</small>
				<b class="truncate text-[14.5px] font-semibold text-ink">{l.title}</b>
				<span class="truncate text-[12.5px]">{l.placeName}, {shortDate(l.date)}</span>
			</span>
			<span class="flex items-center gap-1 text-sm font-semibold text-ink tabular-nums">
				{#if kind === 'top'}<span class="text-accent">{@render star(13)}</span>{l.overall.toFixed(
						1
					)}{:else}{money(logPrice(l))}{/if}
			</span>
			<Icon name="chevR" size={16} weight={2.2} />
		</a>
	</li>
{/snippet}

<section
	aria-labelledby="hl-h"
	class="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5"
>
	<h2 id="hl-h" class="font-display text-[17px] font-semibold">Highlights</h2>
	<ul class="-mx-2 flex flex-col">
		{@render row('top', 'Top rated', highlights.top)}
		{@render row('value', 'Best value', highlights.value)}
		{@render row('splurge', 'Biggest splurge', highlights.splurge)}
	</ul>
</section>
