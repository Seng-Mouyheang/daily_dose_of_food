<script lang="ts">
	/** A single-choice filter as a link, for lists whose filter lives in the URL (Journal,
	 *  Explore): the chosen view can be linked to and works without JavaScript.
	 *
	 *  Selected is a solid `ink` fill with `bg` text, not orange: solid orange is reserved for
	 *  primary actions, and Explore sits under the nav's orange "Write a review". `ink`/`bg`
	 *  swap in dark mode, so it stays the strongest pill in both themes. Not `Chip`, which is a
	 *  button and colors a selected neutral as a complaint. */
	let { href, label, selected }: { href: string; label: string; selected: boolean } = $props();
</script>

<a
	{href}
	aria-current={selected ? 'true' : undefined}
	class="inline-flex h-7.5 shrink-0 items-center rounded-full border px-2.5 text-[13px] whitespace-nowrap transition-colors {selected
		? 'border-ink bg-ink font-semibold text-bg'
		: 'border-line bg-surface font-medium text-ink-2 hover:border-ink-3'}">{label}</a
>
