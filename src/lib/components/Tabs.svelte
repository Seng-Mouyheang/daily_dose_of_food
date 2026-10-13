<script lang="ts">
	/** Underline tabs — the feed's "For you / Following". Distinct from SegmentedControl, which
	 *  is a filled pill group used for mutually exclusive *form input*; these are navigation.
	 *
	 *  Each tab is a real <a>, and the active one is decided by the caller from the URL, so the
	 *  selected tab survives a reload and a shared link, and the feed it names is chosen on the
	 *  server. That also means this needs no state of its own. `aria-current="page"` (not
	 *  aria-selected, which belongs to the ARIA tabs pattern with its own keyboard contract) is
	 *  the correct semantic for a set of links where one is the current page. */
	let {
		options,
		current,
		ariaLabel
	}: {
		options: { value: string; label: string; href: string }[];
		current: string;
		ariaLabel: string;
	} = $props();
</script>

<nav aria-label={ariaLabel} class="flex border-b border-line">
	{#each options as option (option.value)}
		{@const isCurrent = option.value === current}
		<a
			href={option.href}
			aria-current={isCurrent ? 'page' : undefined}
			class={`-mb-px flex min-h-11 flex-1 items-center justify-center border-b-[2.5px] px-2 text-[15px] font-semibold transition-colors lg:flex-none lg:justify-start lg:pr-6 ${
				isCurrent ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'
			}`}
		>
			{option.label}
		</a>
	{/each}
</nav>
