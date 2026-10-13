<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	/** A square icon-only control. Exists because the accessible version of this is three
	 *  things at once — a 44x44 touch target (DESIGN.md §7), an aria-label since there is no
	 *  text, and a hover affordance — and the feed, review page and app chrome need it about a
	 *  dozen times.
	 *
	 *  `inert` is for the controls the handoff draws but this milestone has no backend for
	 *  (save, share, "more"). It renders them visibly but makes them genuinely
	 *  non-interactive — `disabled` on a real <button>, which also takes them out of the tab
	 *  order — rather than wiring up a handler that silently does nothing. Same honesty as the
	 *  inert nav labels in +layout.svelte. They stay at full opacity, unlike Button's disabled
	 *  state: these are placeholders for a coming feature, not actions the user has
	 *  temporarily lost. */
	let {
		icon,
		label,
		href,
		size = 20,
		inert: isInert = false,
		onclick,
		class: extraClass = ''
	}: {
		icon: IconName;
		label: string;
		href?: string;
		size?: number;
		inert?: boolean;
		onclick?: () => void;
		class?: string;
	} = $props();

	// Also the tooltip. Redundant for a live control (the icon plus the label is enough), but
	// for an `inert` one it is the only place the "not available yet" in the label is visible
	// to a sighted mouse user — a disabled button has no other way to explain itself.
	const title = $derived(label);

	const classes = $derived(
		`inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors ${
			isInert ? 'cursor-default' : 'hover:bg-sunken hover:text-ink'
		} ${extraClass}`
	);
</script>

{#if href && !isInert}
	<a {href} aria-label={label} {title} class={classes}>
		<Icon name={icon} {size} />
	</a>
{:else}
	<button type="button" aria-label={label} {title} disabled={isInert} class={classes} {onclick}>
		<Icon name={icon} {size} />
	</button>
{/if}
