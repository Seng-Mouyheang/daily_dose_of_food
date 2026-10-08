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
</script>

<div class="flex gap-1 rounded-input bg-sunken p-1" role="group" aria-label={groupLabel}>
	{#each options as opt (opt.value)}
		{@const selected = value === opt.value}
		<button
			type="button"
			class={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
				selected ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-2'
			}`}
			aria-pressed={selected}
			onclick={() => (value = opt.value)}
		>
			{#if opt.icon}<Icon name={opt.icon} size={18} />{/if}
			{opt.label}
		</button>
	{/each}
</div>
