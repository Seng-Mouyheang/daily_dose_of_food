<script lang="ts">
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { money } from './format.ts';
	import type { DashboardSummary } from './summary.ts';

	let { regulars }: { regulars: DashboardSummary['regulars'] } = $props();
</script>

<section
	aria-labelledby="reg-h"
	class="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="reg-h" class="font-display text-[17px] font-semibold">Your regulars</h2>
		<span class="text-[12.5px] text-ink-3">By visits</span>
	</div>
	{#if regulars.length}
		<ol class="flex flex-col gap-3">
			{#each regulars as p, i (p.id)}
				<li class="flex items-center gap-2.5 text-sm font-semibold">
					<span
						class="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-sunken text-[12.5px] font-bold text-ink-2"
						aria-hidden="true">{i + 1}</span
					>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate">{p.name}</span>
						<small class="text-[12.5px] font-normal text-ink-3"
							>{p.visits} visit{p.visits === 1 ? '' : 's'}, {money(p.spent)}</small
						>
					</span>
					<span
						class="flex items-center gap-1 text-[13px] tabular-nums"
						aria-label="Average {p.rating.toFixed(1)} stars"
					>
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="text-accent"
							aria-hidden="true"><path d={STAR_PATH} /></svg
						>{p.rating.toFixed(1)}
					</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="text-[13px] text-ink-3">No visits in this period yet.</p>
	{/if}
</section>
