<script lang="ts">
	/** Ranked horizontal bars in one color, each row labelled with its value (and %), so the
	 *  bars never have to be read off a legend. */
	let {
		rows,
		max,
		label
	}: {
		rows: { name: string; value: number; text: string; pct?: number }[];
		/** The value a full bar stands for; defaults to the largest row. */
		max?: number;
		label: string;
	} = $props();

	const full = $derived(max ?? Math.max(...rows.map((r) => r.value), 0.0001));
	const withPct = $derived(rows.some((r) => r.pct !== undefined));
</script>

<ul class="flex flex-col gap-2.5" aria-label={label}>
	{#each rows as r (r.name)}
		<li
			class={`grid items-center gap-2.5 text-[13.5px] ${withPct ? 'grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_3.75rem_2.25rem]' : 'grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto]'}`}
		>
			<span class="truncate font-medium text-ink">{r.name}</span>
			<span class="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
				<span
					class="block h-full rounded-full bg-accent"
					style:width="{Math.max(2, (r.value / full) * 100)}%"
				></span>
			</span>
			<span class="text-right font-semibold text-ink tabular-nums">{r.text}</span>
			{#if withPct}<span class="text-right text-[12.5px] text-ink-3 tabular-nums">{r.pct}%</span
				>{/if}
		</li>
	{/each}
</ul>
