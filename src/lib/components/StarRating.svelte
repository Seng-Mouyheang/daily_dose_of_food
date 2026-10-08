<script lang="ts">
	import { STAR_PATH } from './star-path.ts';

	let {
		value = $bindable(),
		max = 5,
		size = 24,
		label
	}: { value: number | null; max?: number; size?: number; label: string } = $props();

	let buttonEls: (HTMLButtonElement | undefined)[] = [];

	// Clicking the already-selected star clears the rating — a mouse-only convenience, kept
	// separate from keyboard selection below, which (like a native radio) only ever sets a
	// definite value and never toggles back to unset.
	function setValue(n: number) {
		value = value === n ? null : n;
	}

	// Roving tabindex (see the ARIA APG radio-group pattern): only one star is ever a Tab stop —
	// the selected one, or the first if none is selected yet — matching native <input
	// type="radio"> group behavior instead of five separate Tab stops.
	function tabIndexFor(n: number): number {
		return (value ?? 1) === n ? 0 : -1;
	}

	function moveTo(n: number) {
		value = n;
		buttonEls[n - 1]?.focus();
	}

	function onKeydown(e: KeyboardEvent, n: number) {
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				e.preventDefault();
				moveTo(n === max ? 1 : n + 1);
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				e.preventDefault();
				moveTo(n === 1 ? max : n - 1);
				break;
			case ' ':
			case 'Enter':
				e.preventDefault();
				value = n;
				break;
		}
	}
</script>

<div class="flex items-center" role="radiogroup" aria-label={label}>
	{#each Array.from({ length: max }, (_, i) => i) as i (i)}
		{@const n = i + 1}
		{@const filled = (value ?? 0) >= n}
		<button
			bind:this={buttonEls[i]}
			type="button"
			role="radio"
			aria-checked={value === n}
			aria-label={`${n} star${n === 1 ? '' : 's'}`}
			tabindex={tabIndexFor(n)}
			class={`rounded p-2.5 transition-colors ${filled ? 'text-accent' : 'text-star-empty'}`}
			onclick={() => setValue(n)}
			onkeydown={(e) => onKeydown(e, n)}
		>
			<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d={STAR_PATH} />
			</svg>
		</button>
	{/each}
</div>
