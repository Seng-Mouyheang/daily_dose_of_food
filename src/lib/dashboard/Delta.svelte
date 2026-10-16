<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';

	/** A change since last period, with an arrow. Green or red only when `better` says which
	 *  direction is good (less spending or eating out, higher ratings); otherwise neutral. */
	let {
		now,
		prev,
		format,
		/** Changes smaller than this read as "Same". */
		unit = 0.005,
		vs = '',
		better
	}: {
		now: number;
		prev: number;
		format: (n: number) => string;
		unit?: number;
		vs?: string;
		better?: 'up' | 'down';
	} = $props();

	const d = $derived(now - prev);
	const flat = $derived(Math.abs(d) < unit);
	const tone = $derived(
		!better || flat ? '' : d > 0 === (better === 'up') ? 'text-good' : 'text-bad'
	);
</script>

<span class="inline-flex items-center gap-1 {tone}">
	<Icon name={flat ? 'flat' : d > 0 ? 'trendUp' : 'trendDown'} size={14} weight={2} />
	{flat ? 'Same' : `${d > 0 ? '+' : '−'}${format(Math.abs(d))}`}{vs ? ` vs ${vs}` : ''}
</span>
