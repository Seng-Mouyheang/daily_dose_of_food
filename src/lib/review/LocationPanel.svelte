<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import MapDoodle from './MapDoodle.svelte';
	import type { FeedPlace } from './card.ts';

	let { place, visitType }: { place: FeedPlace; visitType: string } = $props();

	// Nothing was visited on a delivery order, so a map of the restaurant is beside the point —
	// the handoff drops it for exactly that case.
	const showMap = $derived(visitType !== 'delivery');

	const address = $derived([place.addressLine1, place.city].filter(Boolean).join(', '));

	/** Hands the place's name and address to the viewer's own map app rather than embedding a
	 *  provider here — this app has no tile or directions provider wired up yet, and a search
	 *  query is accurate even without the coordinates. */
	const directionsHref = $derived(
		`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
			[place.name, address].filter(Boolean).join(', ')
		)}`
	);
</script>

<section class="flex flex-col gap-3">
	<h2 class="font-display text-lg font-semibold text-ink">Location</h2>

	{#if showMap}
		<MapDoodle />
	{/if}

	<div class="flex items-center gap-3 rounded-tile border border-line bg-surface p-3">
		<span
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-soft text-accent-strong"
		>
			<Icon name="pin" size={20} />
		</span>
		<div class="min-w-0 flex-1">
			<p class="font-semibold text-ink">{place.name}</p>
			{#if address}
				<p class="truncate text-[13px] text-ink-2">{address}</p>
			{/if}
		</div>
		<!-- A plain anchor rather than <Button href>: this one leaves the app, so it needs
		     target/rel, which Button's props (typed against HTMLButtonAttributes) don't carry. -->
		<a
			href={directionsHref}
			target="_blank"
			rel="noreferrer noopener"
			class="flex h-9 shrink-0 items-center gap-1.5 rounded-input bg-sunken px-3 text-sm font-semibold text-ink transition-colors hover:brightness-95"
		>
			<Icon name="nav" size={15} />
			Directions
		</a>
	</div>
</section>
