<script lang="ts">
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
				<path
					d="M12 2.6l2.85 6 6.55.78-4.85 4.5 1.3 6.5L12 17.1l-5.85 3.28 1.3-6.5L2.6 9.38l6.55-.78z"
				/>
			</svg>
		</button>
	{/each}
</div>
