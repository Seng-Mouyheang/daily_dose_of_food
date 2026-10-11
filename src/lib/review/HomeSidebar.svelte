<script lang="ts">
	import type { MonthlyStats } from './stats.ts';

	/** "Your October" — the viewer's own month, from their own published reviews.
	 *
	 *  The handoff also puts "Popular near you" and "People to follow" in this rail. Both are
	 *  left out: ranking places needs review volume this app doesn't have yet, and suggesting
	 *  people to follow needs a follows table that doesn't exist. A panel of invented names
	 *  would look finished and be fiction. */
	let { stats, month }: { stats: MonthlyStats; month: string } = $props();
</script>

<section class="rounded-card border border-line bg-surface p-5">
	<div class="flex items-center justify-between gap-2">
		<h2 class="font-display text-[17px] font-semibold text-ink">Your {month}</h2>
	</div>

	{#if stats.reviewCount === 0}
		<p class="mt-3 text-sm text-ink-2">
			Nothing written yet this month. Your reviews, average rating and spend will show up here once
			you publish one.
		</p>
	{:else}
		<dl class="mt-4 grid grid-cols-3 rounded-input bg-bg">
			<div class="px-3 py-2.5">
				<dd class="font-display text-[22px] font-semibold text-ink tabular-nums">
					{stats.reviewCount}
				</dd>
				<dt class="text-xs text-ink-2">{stats.reviewCount === 1 ? 'Review' : 'Reviews'}</dt>
			</div>
			<div class="border-l border-line px-3 py-2.5">
				<dd class="font-display text-[22px] font-semibold text-ink tabular-nums">
					{stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)}
				</dd>
				<dt class="text-xs text-ink-2">Avg rating</dt>
			</div>
			<div class="border-l border-line px-3 py-2.5">
				<dd class="font-display text-[22px] font-semibold text-ink tabular-nums">
					${Math.round(stats.totalSpent)}
				</dd>
				<dt class="text-xs text-ink-2">Spent</dt>
			</div>
		</dl>

		{#if stats.habitLine}
			<p class="mt-3 text-sm text-ink-3">{stats.habitLine}</p>
		{/if}
	{/if}
</section>
