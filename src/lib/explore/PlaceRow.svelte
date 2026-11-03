<script lang="ts">
	/** A Places result: pin tile, name and address, and on the right the average with the review
	 *  count under it (the rating sits on the name's line, the count on the address's). Opens the
	 *  place page, carrying the search so its back link can return to it. */
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import Highlight from './Highlight.svelte';
	import type { PlaceResult } from './search.ts';

	let { place, q, query }: { place: PlaceResult; q: string; query: string } = $props();
</script>

<a
	href={`/places/${place.id}?q=${encodeURIComponent(query)}`}
	aria-label={`Show reviews at ${place.name}`}
	class="flex items-center gap-3 py-2"
>
	<span
		class="grid size-8.5 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-strong"
	>
		<Icon name="pin" size={16} />
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-px">
		<span class="text-[15px] font-semibold text-ink"><Highlight text={place.name} {q} /></span>
		{#if place.address}
			<small class="truncate text-[12.5px] text-ink-3">{place.address}</small>
		{/if}
	</span>
	<span class="flex shrink-0 flex-col items-end gap-px">
		<span class="flex items-center gap-[3px] text-[15px] font-semibold text-ink tabular-nums">
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5 text-accent" aria-hidden="true">
				<path d={STAR_PATH} />
			</svg>
			{place.average.toFixed(1)}
		</span>
		<small class="text-[12.5px] whitespace-nowrap text-ink-3"
			>{place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'}</small
		>
	</span>
</a>
