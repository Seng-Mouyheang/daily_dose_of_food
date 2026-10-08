<script lang="ts">
	/** A custom-styled range slider — e.g. sweetness level. Wraps a native `<input type="range">`
	 *  so dragging, keyboard arrows (←/→, Home/End), and screen-reader value announcements all
	 *  work for free; only the paint is custom (filled track + larger thumb). */
	let {
		value = $bindable(),
		min = 0,
		max = 100,
		step = 1,
		label,
		id
	}: {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		/** Accessible name — there's no visible `<label>`, so this is required. */
		label: string;
		id?: string;
	} = $props();

	const fillPct = $derived(((value - min) / (max - min)) * 100);
</script>

<input
	{id}
	type="range"
	{min}
	{max}
	{step}
	bind:value
	aria-label={label}
	class="slider"
	style="--fill: {fillPct}%"
/>

<style>
	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		margin: 11px 0; /* pads the hit area so the thumb's drag target isn't razor-thin */
		border-radius: 999px;
		background: linear-gradient(to right, var(--accent) var(--fill), var(--line) var(--fill));
		outline: none;
		cursor: pointer;
	}

	/* Chromium/Safari paint the track itself over `.slider`'s background unless cleared. */
	.slider::-webkit-slider-runnable-track {
		-webkit-appearance: none;
		height: 6px;
		background: transparent;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 26px;
		height: 26px;
		margin-top: -10px; /* (26px thumb − 6px track) / 2, centers it on the track */
		border-radius: 50%;
		background: var(--accent);
		border: 3px solid var(--surface);
		box-shadow:
			0 1px 2px rgba(70, 45, 20, 0.15),
			0 2px 8px rgba(70, 45, 20, 0.2);
		cursor: grab;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.slider::-moz-range-track {
		height: 6px;
		background: transparent;
	}

	.slider::-moz-range-thumb {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--accent);
		border: 3px solid var(--surface);
		box-shadow:
			0 1px 2px rgba(70, 45, 20, 0.15),
			0 2px 8px rgba(70, 45, 20, 0.2);
		cursor: grab;
	}

	.slider:hover::-webkit-slider-thumb {
		transform: scale(1.08);
	}
	.slider:hover::-moz-range-thumb {
		transform: scale(1.08);
	}

	.slider:active::-webkit-slider-thumb {
		cursor: grabbing;
		transform: scale(1.05);
	}
	.slider:active::-moz-range-thumb {
		cursor: grabbing;
		transform: scale(1.05);
	}

	.slider:focus-visible::-webkit-slider-thumb {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.slider:focus-visible::-moz-range-thumb {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
