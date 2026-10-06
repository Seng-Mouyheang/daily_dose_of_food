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
			class={`relative flex min-h-[44px] flex-col items-center gap-1 rounded-tile border px-3 py-3 text-center transition-colors ${
				selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
			}`}
			aria-pressed={selected}
			onclick={() => (value = opt.value)}
		>
			{#if selected}
				<span
					class="absolute top-1.5 right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-on-accent"
				>
					<Icon name="check" size={12} weight={2.5} />
				</span>
			{/if}
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
