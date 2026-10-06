<script lang="ts">
	import { STAR_PATH } from './star-path.ts';

	let {
		value = $bindable(),
		max = 5,
		size = 24,
		label
	}: { value: number | null; max?: number; size?: number; label: string } = $props();

	function setValue(n: number) {
		value = value === n ? null : n;
	}
</script>

<div class="flex items-center" role="radiogroup" aria-label={label}>
	{#each Array.from({ length: max }, (_, i) => i) as i (i)}
		{@const n = i + 1}
		{@const filled = (value ?? 0) >= n}
		<button
			type="button"
			role="radio"
			aria-checked={value === n}
			aria-label={`${n} star${n === 1 ? '' : 's'}`}
			class={`rounded p-2.5 transition-colors ${filled ? 'text-accent' : 'text-star-empty'}`}
			onclick={() => setValue(n)}
		>
			<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d={STAR_PATH} />
			</svg>
		</button>
	{/each}
</div>
