<script lang="ts">
	import Icon from './Icon.svelte';

	let { text }: { text: string } = $props();

	const TOOLTIP_WIDTH = 224; // px, matches w-56 below
	const GAP = 8;

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined;
	let coords = $state({ top: 0, left: 0 });
	// Svelte 5's SSR-safe id generator — a plain Math.random() id would differ between the
	// server render and the client's first render, which Svelte would flag as a hydration
	// mismatch on the aria-describedby/id pair.
	const tooltipId = $props.id();

	// Positioned via `fixed` + a measured rect rather than `absolute` + an anchor offset,
	// because this lives inside the review wizard's scrolling right rail: an `overflow-y-auto`
	// ancestor forces `overflow-x` to clip too (there's no way to scroll one axis and stay
	// "visible" on the other), so anything `absolute` here gets cut off the moment it needs to
	// extend past that rail's edge. `fixed` escapes ancestor clipping entirely.
	function show() {
		if (triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			coords = {
				top: rect.bottom + GAP,
				left: Math.max(GAP, rect.right - TOOLTIP_WIDTH)
			};
		}
		open = true;
	}

	function hide() {
		open = false;
	}
</script>

<button
	bind:this={triggerEl}
	type="button"
	aria-describedby={open ? tooltipId : undefined}
	aria-label="More info"
	class="flex h-5 w-5 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-accent-strong"
	onpointerenter={show}
	onpointerleave={hide}
	onfocus={show}
	onblur={hide}
>
	<Icon name="info" size={16} />
</button>

{#if open}
	<span
		id={tooltipId}
		role="tooltip"
		class="fixed z-50 w-56 rounded-input border border-line bg-surface p-3 text-xs text-ink-2 shadow-card-lg"
		style={`top: ${coords.top}px; left: ${coords.left}px;`}
	>
		{text}
	</span>
{/if}
