<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { IconName } from '#lib/components/icons.ts';
	import type { FeedPhoto } from './card.ts';

	/** The review page's gallery. One image at a time with arrows and dots on mobile; the
	 *  desktop column also shows a thumbnail strip, which is the same `index` state from a
	 *  different control. No library — this is an index and two buttons. */
	let {
		photos,
		title,
		showThumbnails = false
	}: { photos: FeedPhoto[]; title: string; showThumbnails?: boolean } = $props();

	let index = $state(0);

	// Clamped rather than trusted: `photos` can shrink between renders (a moderated or
	// cleaned-up media row), which would otherwise leave `index` pointing past the end. Every
	// other read of the position — the photo itself, its alt text, the active dot, the next
	// step — goes through this one value, so they can never disagree about where "current" is.
	// `Math.max(0, …)` keeps it in bounds even with no photos, though step() is never reachable
	// there (the arrows only render when `photos.length > 1`).
	const safeIndex = $derived(Math.max(0, Math.min(index, photos.length - 1)));
	const current = $derived(photos[safeIndex] ?? null);

	function step(delta: number) {
		index = (safeIndex + delta + photos.length) % photos.length;
	}

	const controls: { dir: number; side: string; icon: IconName; label: string }[] = [
		{ dir: -1, side: 'left-2.5', icon: 'chevL', label: 'Previous photo' },
		{ dir: 1, side: 'right-2.5', icon: 'chevR', label: 'Next photo' }
	];
</script>

{#if current}
	<div class="flex flex-col gap-2.5">
		<div class="relative overflow-hidden rounded-card bg-sunken">
			<img
				src={current.url}
				alt={current.caption ?? `${title} — photo ${safeIndex + 1} of ${photos.length}`}
				class="block aspect-4/3 w-full object-cover"
			/>

			{#if photos.length > 1}
				{#each controls as control (control.label)}
					<button
						type="button"
						aria-label={control.label}
						onclick={() => step(control.dir)}
						class="absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-scrim text-on-scrim {control.side}"
					>
						<Icon name={control.icon} size={18} weight={2.4} />
					</button>
				{/each}

				<div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
					{#each photos as photo, i (photo.url + i)}
						<button
							type="button"
							aria-label={`Show photo ${i + 1}`}
							aria-current={i === safeIndex ? 'true' : undefined}
							onclick={() => (index = i)}
							class="h-1.5 rounded-full transition-all {i === safeIndex
								? 'w-4 bg-on-scrim'
								: 'w-1.5 bg-on-scrim/60'}"
						></button>
					{/each}
				</div>
			{/if}
		</div>

		{#if showThumbnails && photos.length > 1}
			<div class="flex gap-2.5">
				{#each photos as photo, i (photo.url + i)}
					<button
						type="button"
						aria-label={`Show photo ${i + 1}`}
						onclick={() => (index = i)}
						class="w-[88px] overflow-hidden rounded-input border-2 transition-opacity {i ===
						safeIndex
							? 'border-accent opacity-100'
							: 'border-transparent opacity-75'}"
					>
						<img src={photo.url} alt="" class="block aspect-4/3 w-full object-cover" />
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
