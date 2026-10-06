<script lang="ts">
	/** An on/off switch — e.g. "Add to favorites". Prefer this over a bare checkbox for any
	 *  prominent yes/no setting (see DESIGN.md §4). */
	let {
		checked = $bindable(),
		label,
		tone = 'accent'
	}: { checked: boolean; label: string; tone?: 'accent' | 'fav' } = $props();

	const onClass = $derived(tone === 'fav' ? 'bg-fav' : 'bg-accent');
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? onClass : 'bg-line'}`}
	onclick={() => (checked = !checked)}
>
	<span
		class={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow-card transition-transform ${
			checked ? 'translate-x-[22px]' : 'translate-x-1'
		}`}
	></span>
</button>
