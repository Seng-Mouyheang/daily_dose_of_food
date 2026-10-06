<script lang="ts">
	/** Read-only star display — previews and summaries. For an interactive 1-5 input, use
	 *  StarRating instead; this shares its path data but skips the click handlers and radio
	 *  semantics a static display doesn't need. */
	import { STAR_PATH } from './star-path.ts';

	let {
		value,
		max = 5,
		size = 20
	}: { value: number | null; max?: number; size?: number } = $props();

	const filled = $derived(Math.round(value ?? 0));
</script>

<div class="flex" aria-hidden="true">
	{#each Array.from({ length: max }, (_, i) => i) as i (i)}
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			class={i < filled ? 'text-accent' : 'text-star-empty'}
		>
			<path d={STAR_PATH} />
		</svg>
	{/each}
</div>
