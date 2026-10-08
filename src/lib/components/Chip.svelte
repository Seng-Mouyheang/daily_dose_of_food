<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	let {
		label,
		variant = 'neutral',
		selected = false,
		icon,
		onclick
	}: {
		label: string;
		variant?: 'pos' | 'neg' | 'add' | 'neutral';
		selected?: boolean;
		/** Renders as an icon-only circular pill (`label` becomes its aria-label) instead of
		 *  text — e.g. a "+" add-tag trigger. */
		icon?: IconName;
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

	// Selected pos/neg tags are prefixed with their sign (+ Delicious / − Too expensive),
	// matching the mockups; unselected and neutral/add chips show the bare label.
	const sign = $derived(
		selected && variant === 'pos' ? '+ ' : selected && variant === 'neg' ? '− ' : ''
	);
</script>

<button
	type="button"
	class={`inline-flex h-[30px] items-center justify-center rounded-full border font-medium transition-colors ${icon ? 'w-[30px]' : 'px-3 text-sm'} ${toneClass}`}
	aria-pressed={variant === 'add' || icon ? undefined : selected}
	aria-label={icon ? label : undefined}
	{onclick}
>
	{#if icon}
		<Icon name={icon} size={14} weight={2.5} />
	{:else}
		{sign}{label}
	{/if}
</button>
