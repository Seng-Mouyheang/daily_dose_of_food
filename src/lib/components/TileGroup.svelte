<script lang="ts" generics="T extends string">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	let {
		options,
		value = $bindable(),
		groupLabel,
		columns = 3
	}: {
		options: { value: T; label: string; sub?: string; icon?: IconName }[];
		value: T;
		groupLabel: string;
		columns?: number;
	} = $props();
</script>

<div
	class="grid gap-2.5"
	style={`grid-template-columns: repeat(${columns}, minmax(0, 1fr))`}
	role="group"
	aria-label={groupLabel}
>
	{#each options as opt (opt.value)}
		{@const selected = value === opt.value}
		<button
			type="button"
			class={`flex min-h-11 flex-col items-center gap-1 rounded-tile border px-3 py-3 text-center transition-colors ${
				selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
			}`}
			aria-pressed={selected}
			onclick={() => (value = opt.value)}
		>
			{#if opt.icon}
				<Icon
					name={opt.icon}
					size={22}
					weight={1.6}
					class={selected ? 'text-accent' : 'text-ink-2'}
				/>
			{/if}
			<span class={`text-sm font-semibold ${selected ? 'text-accent-strong' : 'text-ink'}`}
				>{opt.label}</span
			>
			{#if opt.sub}
				<span class="text-xs text-ink-3">{opt.sub}</span>
			{/if}
		</button>
	{/each}
</div>
