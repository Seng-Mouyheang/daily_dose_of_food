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

	// The stars are purely decorative (five generic <svg>s, nothing a screen reader can read on
	// its own), so without this the whole display is invisible to assistive tech — fine when a
	// caller also renders the number as text nearby, but several don't. A distinct label for
	// `null` avoids announcing "0 out of 5 stars" for "not rated yet".
	const label = $derived(
		value === null
			? 'No rating yet'
			: `${Number.isInteger(value) ? value : value.toFixed(1)} out of ${max} stars`
	);
</script>

<div class="flex" role="img" aria-label={label}>
	{#each Array.from({ length: max }, (_, i) => i) as i (i)}
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			class={i < filled ? 'text-accent' : 'text-star-empty'}
		>
			<path d={STAR_PATH} />
		</svg>
	{/each}
</div>
