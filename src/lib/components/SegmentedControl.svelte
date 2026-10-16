<script lang="ts" generics="T extends string">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	let {
		options,
		value = $bindable(),
		groupLabel
	}: {
		options: { value: T; label: string; icon?: IconName }[];
		value: T;
		groupLabel: string;
	} = $props();

	const index = $derived(options.findIndex((o) => o.value === value));
</script>

<div class="relative flex gap-1 rounded-input bg-sunken p-1" role="group" aria-label={groupLabel}>
	<!-- One highlight that slides to the selected option. Options are equal width (flex-1), so
	     its width and step are one option plus the gap. -->
	{#if index >= 0}
		<span
			class="absolute inset-y-1 left-1 rounded-[10px] bg-surface transition-transform duration-300 ease-out"
			style:width="calc((100% - 0.5rem - {options.length - 1} * 0.25rem) / {options.length})"
			style:transform="translateX(calc({index} * (100% + 0.25rem)))"
			aria-hidden="true"
		></span>
	{/if}
	{#each options as opt (opt.value)}
		{@const selected = value === opt.value}
		<button
			type="button"
			class={`relative flex min-h-10 flex-1 basis-0 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
				selected ? 'text-accent-strong' : 'text-ink-2'
			}`}
			aria-pressed={selected}
			onclick={() => (value = opt.value)}
		>
			{#if opt.icon}<Icon name={opt.icon} size={18} />{/if}
			{opt.label}
		</button>
	{/each}
</div>
