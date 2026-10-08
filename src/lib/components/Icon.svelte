<script lang="ts">
	import { ICONS, type IconName } from './icons.ts';

	let {
		name,
		size = 20,
		weight = 1.8,
		class: extraClass = ''
	}: { name: IconName; size?: number; weight?: number; class?: string } = $props();
</script>

<svg
	class={`inline-block shrink-0 ${extraClass}`}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={weight}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<!-- ICONS is a fixed, developer-authored constant (icons.ts), never user input, so there
	     is no injection surface here. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ICONS[name]}
</svg>
