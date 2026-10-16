<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';

	/** A change since last period: neutral grey with an arrow. No green or red, since more
	 *  spending is neither good nor bad on its own. */
	let {
		now,
		prev,
		format,
		/** Changes smaller than this read as "Same". */
		unit = 0.005,
		vs = ''
	}: {
		now: number;
		prev: number;
		format: (n: number) => string;
		unit?: number;
		vs?: string;
	} = $props();

	const d = $derived(now - prev);
	const flat = $derived(Math.abs(d) < unit);
</script>

<span class="inline-flex items-center gap-1">
	<Icon name={flat ? 'flat' : d > 0 ? 'trendUp' : 'trendDown'} size={14} weight={2} />
	{flat ? 'Same' : `${d > 0 ? '+' : '−'}${format(Math.abs(d))}`}{vs ? ` vs ${vs}` : ''}
</span>
