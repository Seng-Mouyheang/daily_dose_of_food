<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { money, shortDate } from './format.ts';
	import { logPrice, type DashLog } from './summary.ts';

	let { recent }: { recent: DashLog[] } = $props();
</script>

<section
	aria-labelledby="recent-h"
	class="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-5"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="recent-h" class="font-display text-[17px] font-semibold">Recent logs</h2>
		<a
			href="/journal"
			class="inline-flex min-h-11 items-center gap-1 rounded-input px-1.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
			>See all<Icon name="chevR" size={16} weight={2.4} /></a
		>
	</div>
	{#if recent.length}
		<ul class="-mx-2 flex flex-col divide-y divide-line">
			{#each recent as l (l.id)}
				<li>
					<a
						href="/review/{l.id}"
						class="flex min-h-11 items-center gap-3 rounded-input p-2 hover:bg-sunken"
					>
						<span
							class="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-sunken text-ink-3"
						>
							<Icon
								name={l.items.length && l.items.every((i) => i.isDrink) ? 'coffee' : 'plate'}
								size={20}
								weight={1.6}
							/>
						</span>
						<span class="flex min-w-0 flex-1 flex-col">
							<b class="truncate text-[14.5px] font-semibold">{l.title}</b>
							<small class="truncate text-[12.5px] text-ink-3"
								>{l.placeName}, {shortDate(l.date)}</small
							>
						</span>
						<span class="flex flex-col items-end font-semibold tabular-nums">
							{money(logPrice(l))}
							<small
								class="flex items-center gap-0.5 text-xs text-ink-2"
								aria-label="{l.overall.toFixed(1)} stars"
							>
								<svg
									width="11"
									height="11"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="text-accent"
									aria-hidden="true"><path d={STAR_PATH} /></svg
								>{l.overall.toFixed(1)}
							</small>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-[13px] text-ink-3">Nothing logged in this period yet.</p>
	{/if}
</section>
