<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		side,
		widthPx,
		storageKey,
		label,
		asideClass = '',
		children
	}: {
		/** Which edge of the layout this rail sits on — drives its border side, slide direction,
		 *  and which edge the floating toggle button sits on. */
		side: 'left' | 'right';
		widthPx: number;
		/** localStorage key this rail's collapsed state is persisted under. */
		storageKey: string;
		/** Used in the toggle button's aria-label, e.g. "step navigation" / "card preview". */
		label: string;
		/** Extra classes for the aside itself (padding, gap, overflow) — the caller's content
		 *  differs enough (a plain scrolling nav vs. a nested scroll container) that those stay
		 *  per-caller rather than baked in here. */
		asideClass?: string;
		children: Snippet;
	} = $props();

	let collapsed = $state(false);
	const isLeft = $derived(side === 'left');

	// Persisted the same way as the draft itself: best-effort, silently no-op without storage.
	onMount(() => {
		try {
			collapsed = localStorage.getItem(storageKey) === 'true';
		} catch {
			// Private browsing / blocked storage: rail just stays expanded.
		}
	});

	$effect(() => {
		try {
			localStorage.setItem(storageKey, String(collapsed));
		} catch {
			// Nothing to persist if storage isn't available.
		}
	});
</script>

<!-- Collapses fully; a floating edge button brings it back. Three layers: this outer div is
     just the positioning context (no clipping, no animated size) so the button below —
     positioned outside the inner box via a negative offset — never gets clipped; the inner div
     animates width (0 <-> widthPx) to reclaim layout space and clips via overflow-hidden; the
     aside inside keeps a constant width and instead slides via translateX, so its own text never
     reflows/squashes mid-animation the way animating the aside's own width directly did. -->
<div class="relative hidden lg:flex lg:h-full">
	<div
		class="shrink-0 transition-all duration-300 ease-in-out lg:h-full lg:overflow-hidden"
		style={`width: ${collapsed ? 0 : widthPx}px;`}
	>
		<aside
			class={`no-scrollbar flex flex-col transition-transform duration-300 ease-in-out lg:h-full ${
				isLeft ? 'border-r' : 'border-l'
			} border-line ${asideClass} ${
				collapsed ? (isLeft ? '-translate-x-full' : 'translate-x-full') : 'translate-x-0'
			}`}
			style={`width: ${widthPx}px;`}
		>
			{@render children()}
		</aside>
	</div>
	<button
		type="button"
		class={`absolute top-16 z-10 flex h-8 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-3 shadow-card transition-all duration-300 ease-in-out hover:text-ink ${
			isLeft ? (collapsed ? '-right-4' : '-right-3') : collapsed ? '-left-4' : '-left-3'
		}`}
		aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
		onclick={() => (collapsed = !collapsed)}
	>
		<Icon
			name={isLeft ? 'chevL' : 'chevR'}
			size={14}
			class={`transition-transform duration-300 ease-in-out ${collapsed ? 'rotate-180' : ''}`}
		/>
	</button>
</div>
