<script lang="ts">
	let {
		label,
		variant = 'neutral',
		selected = false,
		onclick
	}: {
		label: string;
		variant?: 'pos' | 'neg' | 'add' | 'neutral';
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const toneClass = $derived(
		variant === 'add'
			? 'border-dashed border-line text-ink-3'
			: !selected
				? 'border-line bg-surface text-ink-2'
				: variant === 'pos'
					? 'border-good bg-good-soft text-good'
					: 'border-bad bg-bad-soft text-bad'
	);
</script>

<button
	type="button"
	class={`inline-flex h-[30px] items-center rounded-full border px-3 text-sm font-medium transition-colors ${toneClass}`}
	aria-pressed={variant === 'add' ? undefined : selected}
	{onclick}
>
	{label}
</button>
