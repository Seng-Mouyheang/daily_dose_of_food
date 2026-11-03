<script lang="ts">
	/** No results for a search (or for one tab of it), with a few searches that do find
	 *  something to try instead. */
	import Icon from '#lib/components/Icon.svelte';

	let {
		what,
		query,
		hrefFor
	}: {
		/** "results", "people", "places", "dishes or drinks". */
		what: string;
		query: string;
		/** The Explore URL for a suggested search. */
		hrefFor: (q: string) => string;
	} = $props();

	const SUGGESTIONS = ['Fish Amok', 'Coffee', 'Jaiden', 'Russian Market'];
</script>

<div class="flex flex-col items-center gap-2 px-7 py-11 text-center">
	<span class="mb-1 grid size-14 place-items-center rounded-full bg-accent-soft text-accent-strong">
		<Icon name="search" size={24} />
	</span>
	<b class="font-display text-lg font-semibold text-ink">No {what} match “{query}”</b>
	<p class="mb-1.5 max-w-[34ch] text-sm leading-normal text-ink-2">
		Check the spelling, or try a dish, a café or someone's name.
	</p>
	<div class="mt-1 flex flex-wrap justify-center gap-1.5">
		{#each SUGGESTIONS as s (s)}
			<a
				href={hrefFor(s)}
				class="inline-flex h-7.5 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[13px] font-medium whitespace-nowrap text-ink-2 hover:border-ink-3"
			>
				<Icon name="search" size={13} weight={2} />{s}
			</a>
		{/each}
	</div>
</div>
