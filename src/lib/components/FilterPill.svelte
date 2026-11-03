<script lang="ts">
	/** One filter choice as a link, for lists whose filter lives in the URL (Journal, Explore):
	 *  the chosen view can be linked to and works without JavaScript.
	 *
	 *  Selected is a solid `ink` fill with `bg` text, not orange: solid orange is reserved for
	 *  primary actions, and Explore sits under the nav's orange "Write a review". `ink`/`bg`
	 *  swap in dark mode, so it stays the strongest pill in both themes. Not `Chip`, which is a
	 *  button and colors a selected neutral as a complaint.
	 *
	 *  `removable` is a filter that is on and can only be dropped from here (Explore's chips
	 *  under the row): always the selected look, with an × and a "Remove: …" label. `icon` leads
	 *  the label (the Filters panel's ticks and camera).
	 *
	 *  The pill is drawn 28–30px tall; `tap-target` (layout.css) makes the link 44×44 to tap. */
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	let {
		href,
		label,
		selected = false,
		removable = false,
		icon,
		...rest
	}: {
		href: string;
		label: string;
		selected?: boolean;
		removable?: boolean;
		icon?: IconName;
	} & Omit<HTMLAnchorAttributes, 'href' | 'class'> = $props();
</script>

<a
	{href}
	aria-current={selected && !removable ? 'true' : undefined}
	aria-label={removable ? `Remove: ${label}` : undefined}
	{...rest}
	class="tap-target inline-flex shrink-0 items-center justify-center gap-1 rounded-full border whitespace-nowrap transition-colors {removable
		? 'h-7 px-2.5 text-[12.5px]'
		: 'h-7.5 px-2.5 text-[13px]'} {selected || removable
		? 'border-ink bg-ink font-semibold text-bg'
		: 'border-line bg-surface font-medium text-ink-2 hover:border-ink-3'}"
	>{#if icon}<Icon name={icon} size={13} weight={2.6} />{/if}{label}{#if removable}<Icon
			name="x"
			size={13}
			weight={2.4}
		/>{/if}</a
>
