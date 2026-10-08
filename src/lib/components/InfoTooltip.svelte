<script lang="ts">
	import Icon from './Icon.svelte';
	import { portal } from './portal.ts';

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
	// extend past that rail's edge. `fixed` escapes ancestor clipping entirely — except a
	// `position: fixed` element is positioned relative to the nearest ancestor that itself sets
	// a transform (any value other than `none`), not the viewport, if one exists. The rail's
	// collapse animation puts a `translate-x-*` transform on its own ancestor, which would
	// otherwise re-trap and re-clip this tooltip the same way `absolute` was. `portal` (see
	// portal.ts) moves the popover's DOM node to `<body>`, clear of every ancestor, so it stays
	// immune to that regardless of what any future ancestor does.

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

	// WAI-ARIA tooltip pattern: Escape dismisses the tooltip without moving focus off the
	// trigger — a keyboard user who opened it via focus would otherwise have no way to close it
	// short of tabbing away entirely. https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
	function onTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) hide();
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
	onkeydown={onTriggerKeydown}
>
	<Icon name="info" size={16} />
</button>

{#if open}
	<span
		use:portal
		id={tooltipId}
		role="tooltip"
		class="fixed z-50 w-56 rounded-input border border-line bg-surface p-3 text-xs text-ink-2 shadow-card-lg"
		style={`top: ${coords.top}px; left: ${coords.left}px;`}
	>
		{text}
	</span>
{/if}
